import {
  ANALYTICS_COOKIE_NAME,
  createAnalyticsSessionValue,
  getAnalyticsSessionCookie,
  getAnalyticsSessionCookieOptions,
  getClearedAnalyticsSessionCookieOptions,
  isValidAnalyticsSession,
} from "@/lib/auth/analyticsSession";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const analyticsAdminPassword = process.env.ANALYTICS_ADMIN_PASSWORD?.trim() || null;
const ANALYTICS_SESSION_TYPE = "analytics_admin";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_TEXT_LENGTH = 5000;
const MAX_REQUEST_BYTES = 16 * 1024;
const FEEDBACK_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FEEDBACK_RATE_LIMIT_MAX_REQUESTS = 12;
const feedbackRateLimitStore = new Map<string, { count: number; resetAt: number }>();

type FeedbackAction = "unlock_analytics" | "update_workflow_status" | null;
type FeedbackType =
  | "up"
  | "down"
  | "improve"
  | "idea"
  | "auto_debug"
  | "workflow_status"
  | null;

type FeedbackRequestBody = {
  action: FeedbackAction;
  password: string | null;
  chatId: string | null;
  msgIndex: number | null;
  type: FeedbackType;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  environment: string | null;
  workflowKey: string | null;
  workflowStatus: string | null;
  learningType: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function toSafeErrorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}

function logSafeError(label: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(label, {
    ...extra,
    ...toSafeErrorMeta(error),
  });
}

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function getRateLimitHeaders(rateLimit: RateLimitResult) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
  );

  return {
    "X-OpenLura-RateLimit-Limit": String(FEEDBACK_RATE_LIMIT_MAX_REQUESTS),
    "X-OpenLura-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining)),
    "X-OpenLura-RateLimit-Reset": String(rateLimit.resetAt),
    "Retry-After": String(retryAfterSeconds),
  };
}

function buildHeadersWithRateLimit(rateLimit?: RateLimitResult) {
  if (!rateLimit) {
    return NO_STORE_HEADERS;
  }

  return {
    ...NO_STORE_HEADERS,
    ...getRateLimitHeaders(rateLimit),
  };
}

function checkFeedbackRateLimit(req: Request) {
  const ip = getRequestIp(req);
  const now = Date.now();
  const existing = feedbackRateLimitStore.get(ip);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + FEEDBACK_RATE_LIMIT_WINDOW_MS;

    feedbackRateLimitStore.set(ip, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: FEEDBACK_RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    };
  }

  if (existing.count >= FEEDBACK_RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  feedbackRateLimitStore.set(ip, existing);

  return {
    allowed: true,
    remaining: Math.max(0, FEEDBACK_RATE_LIMIT_MAX_REQUESTS - existing.count),
    resetAt: existing.resetAt,
  };
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  return {
    feedbackTableUrl: `${supabaseUrl}/rest/v1/openlura_feedback`,
    supabaseServiceRoleKey: supabaseServiceRoleKey as string,
  };
}

function badRequest(message: string, rateLimit?: RateLimitResult) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 400,
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );
}

function unauthorized(message = "Unauthorized", rateLimit?: RateLimitResult) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 401,
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );
}

function payloadTooLarge(rateLimit?: RateLimitResult) {
  return NextResponse.json(
    { success: false, error: "Request too large" },
    {
      status: 413,
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
}

function normalizeOptionalNumber(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return null;
  }

  return value;
}

function normalizeWorkflowStatus(value: unknown) {
  const normalized = normalizeOptionalString(value, 100)?.toLowerCase() || null;

  if (!normalized) {
    return null;
  }

  if (!/^[a-z0-9_-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeLearningType(value: unknown) {
  const normalized = normalizeOptionalString(value, 50)?.toLowerCase() || null;

  if (!normalized) {
    return null;
  }

  if (normalized !== "style" && normalized !== "content") {
    return null;
  }

  return normalized;
}

function normalizeEnvironment(value: unknown) {
  const normalized = normalizeOptionalString(value, 50)?.toLowerCase() || null;

  if (!normalized) {
    return null;
  }

  if (normalized !== "default" && normalized !== "personal") {
    return null;
  }

  return normalized;
}

function normalizeFeedbackType(value: unknown): FeedbackType {
  const normalized = normalizeOptionalString(value, 50)?.toLowerCase() || null;

  if (!normalized) {
    return null;
  }

  if (
    normalized === "up" ||
    normalized === "down" ||
    normalized === "improve" ||
    normalized === "idea" ||
    normalized === "auto_debug" ||
    normalized === "workflow_status"
  ) {
    return normalized;
  }

  return null;
}

function isPersonalEnvironmentRequest(req: Request) {
  return req.headers.get("x-openlura-personal-env") === "true";
}

function normalizeIdeaSource(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === "idea_bug" ||
    normalized === "idea_adjustment" ||
    normalized === "idea_feedback_learning" ||
    normalized === "personal_environment"
  ) {
    return normalized;
  }

  return null;
}

function safeSecretEquals(input: string, expected: string) {
  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

async function readJsonBodyWithinLimit(req: Request, maxBytes: number) {
  const rawText = await req.text();
  const rawBytes = Buffer.byteLength(rawText, "utf8");

  if (rawBytes > maxBytes) {
    return {
      ok: false as const,
      reason: "too_large" as const,
      body: null,
    };
  }

  try {
    return {
      ok: true as const,
      reason: null,
      body: JSON.parse(rawText) as unknown,
    };
  } catch {
    return {
      ok: false as const,
      reason: "invalid_json" as const,
      body: null,
    };
  }
}

function createFeedbackWorkflowKey(input: {
  chatId: string | null;
  msgIndex: number | null;
  type: FeedbackType;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  environment: string | null;
  userScope: string | null;
  user_id: string | null;
}) {
  return [
    input.chatId || "",
    input.msgIndex ?? "",
    input.type || "",
    input.source || "",
    input.environment || "",
    input.userScope || "",
    input.user_id || "",
    input.userMessage || "",
    input.message || "",
  ].join("::");
}

function parseFeedbackRequestBody(body: unknown): FeedbackRequestBody | null {
  if (!isPlainObject(body)) {
    return null;
  }

  return {
    action:
      body.action === "unlock_analytics" || body.action === "update_workflow_status"
        ? body.action
        : null,
    password: normalizeOptionalString(body.password, 1000),
    chatId: normalizeOptionalString(body.chatId, 200),
    msgIndex: normalizeOptionalNumber(body.msgIndex),
    type: normalizeFeedbackType(body.type),
    message: normalizeOptionalString(body.message),
    userMessage: normalizeOptionalString(body.userMessage),
    source: normalizeOptionalString(body.source, 100),
    environment: normalizeEnvironment(body.environment),
    workflowKey: normalizeOptionalString(body.workflowKey, 500),
    workflowStatus: normalizeWorkflowStatus(body.workflowStatus),
    learningType: normalizeLearningType(body.learningType),
  };
}

function isFeedbackReadAuthorized(req: Request) {
  return isValidAnalyticsSession(getAnalyticsSessionCookie(req));
}

function getContentLength(req: Request) {
  const raw = req.headers.get("content-length");

  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  return Number(raw);
}

async function resolveFeedbackIdentity(req: Request) {
  const softIdentity = await resolveOpenLuraRequestIdentity(req);

  return {
    userId: softIdentity.userId,
    isAuthenticatedPersonalUser: softIdentity.isAuthenticated && !!softIdentity.userId,
  };
}

async function fetchAllFeedbackEntries(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  query: string;
}) {
  const pageSize = 1000;
  let offset = 0;
  let allRows: unknown[] = [];

  while (true) {
    const headers = new Headers();
    headers.set("apikey", input.supabaseServiceRoleKey);
    headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);

    const pagedQuery = `${input.query}&limit=${pageSize}&offset=${offset}`;

    const res = await fetch(`${input.feedbackTableUrl}?${pagedQuery}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Feedback fetch failed ${res.status}: ${errorText}`);
    }

    const pageData: unknown = await res.json();
    const pageRows = Array.isArray(pageData) ? pageData : [];

    allRows = [...allRows, ...pageRows];

    if (pageRows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

function mapFeedbackRowToApi(row: Record<string, unknown>) {
  return {
    chatId: row.chatId ?? null,
    msgIndex: row.msgIndex ?? null,
    type: row.type ?? null,
    message: row.message ?? null,
    userMessage: row.userMessage ?? null,
    source: row.source ?? null,
    userScope: row.userScope ?? null,
    user_id: row.user_id ?? null,
    environment: row.environment ?? null,
    timestamp: row.timestamp ?? null,
    workflowKey: row.workflowKey ?? null,
    workflowStatus: row.workflowStatus ?? null,
    learningType: row.learningType ?? null,
  };
}

function mapFeedbackEntryToDb(entry: {
  chatId: string | null;
  msgIndex: number | null;
  type: FeedbackType;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  userScope: string | null;
  user_id: string | null;
  environment: string | null;
  timestamp: string;
  workflowKey: string;
  workflowStatus: string | null;
  learningType: string | null;
}) {
  return {
  chatId: entry.chatId,
  msgIndex: entry.msgIndex,
  type: entry.type,
  message: entry.message,
  userMessage: entry.userMessage,
  source: entry.source,
  userScope: entry.userScope,
  user_id: entry.user_id,
  environment: entry.environment,
  timestamp: entry.timestamp,
  workflowKey: entry.workflowKey,
  workflowStatus: entry.workflowStatus,
  learningType: entry.learningType,
};
}

async function saveFeedbackEntry(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  entry: {
    chatId: string | null;
    msgIndex: number | null;
    type: FeedbackType;
    message: string | null;
    userMessage: string | null;
    source: string | null;
    userScope: string | null;
    user_id: string | null;
    environment: string | null;
    timestamp: string;
    workflowKey: string;
    workflowStatus: string | null;
    learningType: string | null;
  };
  errorLabel: string;
}) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Prefer", "return=representation");

  const dbEntry = mapFeedbackEntryToDb(input.entry);

  const res = await fetch(input.feedbackTableUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(dbEntry),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${input.errorLabel} ${res.status}: ${errorText}`);
  }

  const data: unknown = await res.json();
  return Array.isArray(data)
    ? data.map((row) => mapFeedbackRowToApi(row as Record<string, unknown>))
    : [];
}

function inferIdeaSource(
  type: FeedbackType,
  message: string | null,
  source: string | null
) {
  if (type !== "idea") {
    return source;
  }

  const explicitSource = normalizeIdeaSource(source);

  if (explicitSource) {
    return explicitSource;
  }

  const rawMessage = (message || "").toLowerCase();

  if (
    rawMessage.includes("bug") ||
    rawMessage.includes("werkt niet") ||
    rawMessage.includes("error") ||
    rawMessage.includes("fout") ||
    rawMessage.includes("crash") ||
    rawMessage.includes("stuk") ||
    rawMessage.includes("kapot")
  ) {
    return "idea_bug";
  }

  if (
    rawMessage.includes("aanpassen") ||
    rawMessage.includes("aanpassing") ||
    rawMessage.includes("toevoegen") ||
    rawMessage.includes("maak") ||
    rawMessage.includes("zet") ||
    rawMessage.includes("verander") ||
    rawMessage.includes("wijzig")
  ) {
    return "idea_adjustment";
  }

  if (
    rawMessage.includes("ai") ||
    rawMessage.includes("antwoord") ||
    rawMessage.includes("reageer") ||
    rawMessage.includes("korter") ||
    rawMessage.includes("duidelijker") ||
    rawMessage.includes("beter") ||
    rawMessage.includes("leren")
  ) {
    return "idea_feedback_learning";
  }

  return "idea_adjustment";
}

export async function POST(req: Request) {
  const rateLimit = checkFeedbackRateLimit(req);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      {
        status: 429,
        headers: buildHeadersWithRateLimit(rateLimit),
      }
    );
  }

  try {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > MAX_REQUEST_BYTES) {
      return payloadTooLarge(rateLimit);
    }

    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const parsedBody = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

    if (!parsedBody.ok) {
      if (parsedBody.reason === "too_large") {
        return payloadTooLarge(rateLimit);
      }

      return badRequest("Invalid request body", rateLimit);
    }

    const data = parseFeedbackRequestBody(parsedBody.body);

    if (!data) {
      return badRequest("Invalid request body", rateLimit);
    }

    if (
      isPlainObject(parsedBody.body) &&
      typeof parsedBody.body.environment === "string" &&
      !data.environment
    ) {
      return badRequest("Invalid environment", rateLimit);
    }

    if (data.action === "unlock_analytics") {
  if (!analyticsAdminPassword) {
    return NextResponse.json(
      { success: false, error: "Analytics auth not configured" },
      {
        status: 500,
        headers: buildHeadersWithRateLimit(rateLimit),
      }
    );
  }

  const submittedPassword = (data.password || "").trim();

  if (!safeSecretEquals(submittedPassword, analyticsAdminPassword)) {
    return NextResponse.json(
      { success: false, error: "Verkeerd wachtwoord" },
      {
        status: 401,
        headers: buildHeadersWithRateLimit(rateLimit),
      }
    );
  }

  const response = NextResponse.json(
    {
      success: true,
      runtime: {
        sessionType: ANALYTICS_SESSION_TYPE,
        authenticated: true,
      },
    },
    {
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );

  response.cookies.set(
    ANALYTICS_COOKIE_NAME,
    createAnalyticsSessionValue(),
    getAnalyticsSessionCookieOptions()
  );

  return response;
}

const identity = await resolveFeedbackIdentity(req);
const personalEnvironmentRequested = isPersonalEnvironmentRequest(req);
const isAnalyticsWorkflowUpdate = data.action === "update_workflow_status";
const hasAnalyticsAccess = isFeedbackReadAuthorized(req);
const explicitlyPersonalEnvironment = data.environment === "personal";

if (isAnalyticsWorkflowUpdate && !hasAnalyticsAccess) {
  return unauthorized("Analytics authorization required", rateLimit);
}

if (
  explicitlyPersonalEnvironment &&
  !personalEnvironmentRequested &&
  !isAnalyticsWorkflowUpdate
) {
  return badRequest("Personal environment header required", rateLimit);
}

const wantsPersonalEnvironment =
  explicitlyPersonalEnvironment && personalEnvironmentRequested;

if (
  wantsPersonalEnvironment &&
  !identity.isAuthenticatedPersonalUser &&
  !isAnalyticsWorkflowUpdate
) {
  return unauthorized("Personal feedback requires authentication", rateLimit);
}

const isPersonalEnvironment =
  wantsPersonalEnvironment &&
  (identity.isAuthenticatedPersonalUser || isAnalyticsWorkflowUpdate);

if (data.action === "update_workflow_status") {
  if (!data.workflowKey || !data.workflowStatus) {
    return badRequest("Missing workflowKey or workflowStatus", rateLimit);
  }

  if (
    data.workflowStatus !== "nieuw" &&
    data.workflowStatus !== "bezig" &&
    data.workflowStatus !== "klaar"
  ) {
    return badRequest("Invalid workflowStatus", rateLimit);
  }
}

if (!data.type && !isAnalyticsWorkflowUpdate) {
  return badRequest("Missing feedback type", rateLimit);
}

if (
  data.action !== "update_workflow_status" &&
  data.type === "workflow_status"
) {
  return badRequest("Invalid feedback type for this action", rateLimit);
}

const timestamp = new Date().toISOString();
const environment = isPersonalEnvironment ? "personal" : "default";
const hasAuthenticatedPersonalContext =
  !isAnalyticsWorkflowUpdate &&
  isPersonalEnvironment &&
  identity.isAuthenticatedPersonalUser &&
  !!identity.userId;
const userScope = isAnalyticsWorkflowUpdate
  ? "admin"
  : isPersonalEnvironment
  ? "personal"
  : "guest";
const user_id = hasAuthenticatedPersonalContext ? identity.userId || null : null;

const resolvedType: FeedbackType = isAnalyticsWorkflowUpdate
  ? "workflow_status"
  : data.type;

const resolvedSource = isAnalyticsWorkflowUpdate
  ? "analytics_workflow"
  : data.type === "idea" &&
    data.source === "personal_environment" &&
    !isPersonalEnvironment
  ? inferIdeaSource(data.type, data.message, null)
  : inferIdeaSource(data.type, data.message, data.source);

const baseEntry = {
  chatId: data.chatId,
  msgIndex: data.msgIndex,
  type: resolvedType,
  message: isAnalyticsWorkflowUpdate ? data.workflowStatus : data.message,
  userMessage: data.userMessage,
  source: resolvedSource,
  userScope,
  user_id,
  environment,
  timestamp,
  learningType: data.learningType,
};

const workflowKey =
  data.workflowKey ||
  createFeedbackWorkflowKey({
    ...baseEntry,
    userScope,
    user_id,
    environment,
  });

const entry: {
  chatId: string | null;
  msgIndex: number | null;
  type: FeedbackType;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  userScope: string | null;
  user_id: string | null;
  environment: string | null;
  timestamp: string;
  workflowKey: string;
  workflowStatus: string | null;
  learningType: string | null;
} = {
  ...baseEntry,
  workflowKey,
  workflowStatus: isAnalyticsWorkflowUpdate ? data.workflowStatus || null : null,
};

try {
  let saved;

  if (data.action === "update_workflow_status") {
    const workflowHeaders = new Headers();
    workflowHeaders.set("Content-Type", "application/json");
    workflowHeaders.set("apikey", supabaseServiceRoleKey);
    workflowHeaders.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    workflowHeaders.set("Prefer", "return=representation");

    const workflowQuery =
      `type=eq.workflow_status&source=eq.analytics_workflow&workflowKey=eq.${encodeURIComponent(
        workflowKey
      )}`;

    const updateRes = await fetch(`${feedbackTableUrl}?${workflowQuery}`, {
      method: "PATCH",
      headers: workflowHeaders,
      body: JSON.stringify({
        message: entry.message,
        workflowStatus: entry.workflowStatus,
        timestamp: entry.timestamp,
        environment: entry.environment,
      }),
      cache: "no-store",
    });

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      throw new Error(`Workflow update failed ${updateRes.status}: ${errorText}`);
    }

    const updatedRows: unknown = await updateRes.json();
    const normalizedUpdatedRows = Array.isArray(updatedRows)
      ? updatedRows.map((row) => mapFeedbackRowToApi(row as Record<string, unknown>))
      : [];

    if (normalizedUpdatedRows.length > 0) {
      saved = normalizedUpdatedRows;
    } else {
      saved = await saveFeedbackEntry({
        feedbackTableUrl,
        supabaseServiceRoleKey,
        entry,
        errorLabel: "Workflow status opslaan mislukt:",
      });
    }
  } else {
    saved = await saveFeedbackEntry({
      feedbackTableUrl,
      supabaseServiceRoleKey,
      entry,
      errorLabel: "Feedback opslaan mislukt:",
    });
  }

  return NextResponse.json(
    {
      success: true,
      item: saved[0] ?? entry,
    },
    {
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );
}
    
    catch (error) {
      logSafeError("Feedback POST save failed", error, {
        action: data.action || "feedback",
        environment: entry.environment,
        userScope: entry.userScope,
        hasUserId: !!entry.user_id,
      });

      return NextResponse.json(
        {
          success: false,
          error:
            data.action === "update_workflow_status"
              ? "Workflow status opslaan mislukt"
              : "Feedback opslaan mislukt",
        },
        {
          status: 500,
          headers: buildHeadersWithRateLimit(rateLimit),
        }
      );
    }
  } catch (error) {
    logSafeError("Feedback POST failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Feedback opslaan mislukt",
      },
      {
        status: 500,
        headers: buildHeadersWithRateLimit(rateLimit),
      }
    );
  }
}
export async function GET(req: Request) {
  try {
    if (!isFeedbackReadAuthorized(req)) {
      return unauthorized();
    }

    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const query =
      "select=chatId,msgIndex,type,message,userMessage,source,userScope,user_id,environment,timestamp,workflowKey,workflowStatus,learningType" +
      "&order=timestamp.desc.nullslast";

    let data: unknown;

    try {
      data = await fetchAllFeedbackEntries({
        feedbackTableUrl,
        supabaseServiceRoleKey: String(supabaseServiceRoleKey),
        query,
      });
    } catch (error) {
      logSafeError("Supabase feedback GET failed", error);

      return NextResponse.json(
        {
          success: false,
          error: "Feedback ophalen mislukt",
        },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(Array.isArray(data) ? data : [], {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    logSafeError("Feedback GET failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Feedback ophalen mislukt",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const hadSession = isValidAnalyticsSession(getAnalyticsSessionCookie(req));

    const response = NextResponse.json(
      {
        success: true,
        runtime: {
          sessionType: ANALYTICS_SESSION_TYPE,
          clearedSession: hadSession,
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );

    response.cookies.set(
      ANALYTICS_COOKIE_NAME,
      "",
      getClearedAnalyticsSessionCookieOptions()
    );

    return response;
  } catch (error) {
    logSafeError("Feedback DELETE failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Analytics logout mislukt",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}