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
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of feedbackRateLimitStore.entries()) {
    if (value.resetAt <= now) {
      feedbackRateLimitStore.delete(key);
    }
  }
}

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

type CanonicalFeedbackEntry = {
  chatId: string | null;
  msgIndex: number | null;
  type: Exclude<FeedbackType, null>;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  userScope: "admin" | "guest" | "personal" | "user";
  user_id: string | null;
  environment: "default" | "personal";
  timestamp: string;
  workflowKey: string;
  workflowStatus: string | null;
  learningType: "style" | "content" | null;
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

async function checkFeedbackRateLimit(req: Request) {
  cleanupRateLimitStore();

  const ip = getRequestIp(req);
  const identity = await resolveOpenLuraRequestIdentity(req);
  const userKey = identity?.userId || "anon";
  const rateLimitKey = `${ip}:${userKey}`;
  const now = Date.now();
  const existing = feedbackRateLimitStore.get(rateLimitKey);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + FEEDBACK_RATE_LIMIT_WINDOW_MS;

    feedbackRateLimitStore.set(rateLimitKey, {
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
  feedbackRateLimitStore.set(rateLimitKey, existing);

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

const MAX_FEEDBACK_PAGES = 10; // max 10_000 rows

async function fetchAllFeedbackEntries(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  query: string;
}) {
  const pageSize = 1000;
  let offset = 0;
  let allRows: unknown[] = [];
  let page = 0;

  while (page < MAX_FEEDBACK_PAGES) {
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
    page += 1;

    if (pageRows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

function normalizeFeedbackUserScope(
  value: unknown
): "admin" | "guest" | "personal" | "user" | null {
  return value === "admin" ||
    value === "guest" ||
    value === "personal" ||
    value === "user"
    ? value
    : null;
}

function normalizeFeedbackEnvironment(
  value: unknown
): "default" | "personal" | null {
  return value === "default" || value === "personal" ? value : null;
}

function normalizeFeedbackWorkflowStatus(
  value: unknown
): "new" | "in_progress" | "done" | "nieuw" | "bezig" | "klaar" | null {
  // Support both legacy NL values and new EN values for backwards compatibility
  return value === "new" ||
    value === "in_progress" ||
    value === "done" ||
    value === "nieuw" ||
    value === "bezig" ||
    value === "klaar"
    ? value
    : null;
}

function mapFeedbackRowToApi(row: Record<string, unknown>): CanonicalFeedbackEntry | {
  chatId: string | null;
  msgIndex: number | null;
  type: FeedbackType;
  message: string | null;
  userMessage: string | null;
  source: string | null;
  userScope: "admin" | "guest" | "personal" | "user" | null;
  user_id: string | null;
  environment: "default" | "personal" | null;
  timestamp: string | null;
  workflowKey: string | null;
  workflowStatus: "new" | "in_progress" | "done" | "nieuw" | "bezig" | "klaar" | null;
  learningType: "style" | "content" | null;
} {
  const normalizedType = normalizeFeedbackType(row.type);
  const normalizedEnvironment = normalizeFeedbackEnvironment(row.environment);
  const normalizedUserScope = normalizeFeedbackUserScope(row.userScope);
  const normalizedLearningType = normalizeLearningType(row.learningType);
  const normalizedWorkflowStatus = normalizeFeedbackWorkflowStatus(
    row.workflowStatus
  );

  return {
    chatId: typeof row.chatId === "string" ? row.chatId : null,
    msgIndex:
      typeof row.msgIndex === "number" && Number.isInteger(row.msgIndex)
        ? row.msgIndex
        : null,
    type: normalizedType,
    message: typeof row.message === "string" ? row.message : null,
    userMessage: typeof row.userMessage === "string" ? row.userMessage : null,
    source: typeof row.source === "string" ? row.source : null,
    userScope: normalizedUserScope,
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    environment: normalizedEnvironment,
    timestamp: typeof row.timestamp === "string" ? row.timestamp : null,
    workflowKey: typeof row.workflowKey === "string" ? row.workflowKey : null,
    workflowStatus: normalizedWorkflowStatus,
    learningType: normalizedLearningType,
  };
}

function mapFeedbackEntryToDb(entry: CanonicalFeedbackEntry) {
  const environment: "default" | "personal" =
    entry.environment === "personal" ? "personal" : "default";

  const userScope: "admin" | "guest" | "personal" | "user" =
    entry.userScope === "admin" ||
    entry.userScope === "guest" ||
    entry.userScope === "personal" ||
    entry.userScope === "user"
      ? entry.userScope
      : environment === "personal"
      ? "personal"
      : "guest";

  const user_id =
    environment === "personal" || userScope === "user"
      ? entry.user_id || null
      : null;

  return {
    chatId: entry.chatId,
    msgIndex: entry.msgIndex,
    type: entry.type,
    message: entry.message,
    userMessage: entry.userMessage,
    source: entry.source,
    userScope,
    user_id,
    environment,
    timestamp: entry.timestamp,
    workflowKey: entry.workflowKey,
    workflowStatus: entry.workflowStatus,
    learningType: entry.learningType,
  };
}

function resolveCanonicalLearningType(input: {
  type: FeedbackType;
  learningType: string | null;
  message: string | null;
  userMessage: string | null;
}) {
  if (input.type === "workflow_status" || input.type === "auto_debug") {
    return input.learningType === "style" || input.learningType === "content"
      ? input.learningType
      : null;
  }

  if (input.learningType === "style" || input.learningType === "content") {
    return input.learningType;
  }

  const combined = `${input.userMessage || ""} ${input.message || ""}`.toLowerCase();

  const isStyleSignal =
    /korter|te lang|shorter|too long|duidelijker|onduidelijk|clearer|unclear|structuur|structure|vaag|vague|meer context|more context|menselijker|spontaner|luchtiger|too formal|more natural/.test(
      combined
    );

  return isStyleSignal ? "style" : "content";
}

function sanitizeWorkflowKey(value: string) {
  return value.trim().slice(0, 500);
}

function buildCanonicalWorkflowAdminEntry(
  entry: CanonicalFeedbackEntry
): CanonicalFeedbackEntry {
  return {
    ...entry,
    type: "workflow_status",
    source: "analytics_workflow",
    userScope: "admin",
    user_id: null,
    environment: "default",
    learningType: null,
    workflowStatus: entry.workflowStatus,
  };
}

function buildCanonicalFeedbackEntry(input: {
  data: FeedbackRequestBody;
  identity: {
    userId: string | null;
    isAuthenticatedPersonalUser: boolean;
  };
  isAnalyticsWorkflowUpdate: boolean;
  canonicalEnvironment: "default" | "personal";
}): CanonicalFeedbackEntry {
  const timestamp = new Date().toISOString();
  const environment: "default" | "personal" = input.canonicalEnvironment;

  const userScope: "admin" | "guest" | "personal" | "user" =
    input.isAnalyticsWorkflowUpdate
      ? "admin"
      : environment === "personal"
      ? "personal"
      : input.identity.isAuthenticatedPersonalUser && input.identity.userId
      ? "user"
      : "guest";

  const user_id =
    !input.isAnalyticsWorkflowUpdate &&
    (
      (environment === "personal" && input.identity.isAuthenticatedPersonalUser) ||
      userScope === "user"
    ) &&
    input.identity.userId
      ? input.identity.userId
      : null;

  const resolvedType: Exclude<FeedbackType, null> = input.isAnalyticsWorkflowUpdate
    ? "workflow_status"
    : (input.data.type as Exclude<FeedbackType, null>);

  const resolvedSource = input.isAnalyticsWorkflowUpdate
    ? "analytics_workflow"
    : input.data.type === "idea" &&
        input.data.source === "personal_environment" &&
        environment !== "personal"
      ? inferIdeaSource(input.data.type, input.data.message, null)
      : inferIdeaSource(input.data.type, input.data.message, input.data.source);

  const message = input.isAnalyticsWorkflowUpdate
    ? input.data.workflowStatus
    : input.data.message;

  const workflowStatus = input.isAnalyticsWorkflowUpdate
    ? input.data.workflowStatus || null
    : null;
  const workflowKey = sanitizeWorkflowKey(
    input.data.workflowKey ||
      createFeedbackWorkflowKey({
        chatId: input.data.chatId,
        msgIndex: input.data.msgIndex,
        type: resolvedType,
        message,
        userMessage: input.data.userMessage,
        source: resolvedSource,
        environment,
        userScope,
        user_id,
      })
  );

  return {
    chatId: input.data.chatId,
    msgIndex: input.data.msgIndex,
    type: resolvedType,
    message,
    userMessage: input.data.userMessage,
    source: resolvedSource,
    userScope,
    user_id,
    environment,
    timestamp,
    workflowKey,
    workflowStatus,
    learningType: resolveCanonicalLearningType({
      type: resolvedType,
      learningType: input.data.learningType,
      message,
      userMessage: input.data.userMessage,
    }),
  };
}

async function saveFeedbackEntry(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  entry: CanonicalFeedbackEntry;
  errorLabel: string;
}) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Prefer", "return=representation");

  const dedupeQuery =
    `select=chatId,msgIndex,type,message,userMessage,source,userScope,user_id,environment,timestamp,workflowKey,workflowStatus,learningType` +
    `&workflowKey=eq.${encodeURIComponent(input.entry.workflowKey)}` +
    `&type=eq.${encodeURIComponent(input.entry.type)}` +
    `&${buildPostgrestEqOrNullFilter("source", input.entry.source)}` +
    `&userScope=eq.${encodeURIComponent(input.entry.userScope)}` +
    `&environment=eq.${encodeURIComponent(input.entry.environment)}` +
    `&${buildPostgrestEqOrNullFilter("user_id", input.entry.user_id)}` +
    `&order=timestamp.desc` +
    `&limit=1`;

  const existingRes = await fetch(`${input.feedbackTableUrl}?${dedupeQuery}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!existingRes.ok) {
    const errorText = await existingRes.text();
    throw new Error(`${input.errorLabel} dedupe check failed ${existingRes.status}: ${errorText}`);
  }

  const existingData: unknown = await existingRes.json();
  const existingRows = Array.isArray(existingData) ? existingData : [];

  if (existingRows.length > 0) {
    return existingRows.map((row) => mapFeedbackRowToApi(row as Record<string, unknown>));
  }

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
function buildPostgrestEqOrNullFilter(column: string, value: string | null) {
  if (value === null) {
    return `${column}=is.null`;
  }

  return `${column}=eq.${encodeURIComponent(value)}`;
}

function resolveCanonicalRequestEnvironment(input: {
  requestedEnvironment: string | null;
  personalEnvironmentHeader: boolean;
  isAuthenticatedPersonalUser: boolean;
  isAnalyticsWorkflowUpdate: boolean;
}) {
  if (input.isAnalyticsWorkflowUpdate) {
    return "default" as const;
  }

  if (input.personalEnvironmentHeader) {
    if (!input.isAuthenticatedPersonalUser) {
      return null;
    }

    return "personal" as const;
  }

  if (input.requestedEnvironment === "personal") {
    return null;
  }

  return "default" as const;
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
    rawMessage.includes("doesn't work") ||
    rawMessage.includes("does not work") ||
    rawMessage.includes("not working") ||
    rawMessage.includes("error") ||
    rawMessage.includes("fout") ||
    rawMessage.includes("crash") ||
    rawMessage.includes("broken") ||
    rawMessage.includes("stuk") ||
    rawMessage.includes("kapot") ||
    rawMessage.includes("fix") ||
    rawMessage.includes("kaputt") ||
    rawMessage.includes("ne fonctionne pas") ||
    rawMessage.includes("no funciona")
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
    rawMessage.includes("wijzig") ||
    rawMessage.includes("add") ||
    rawMessage.includes("change") ||
    rawMessage.includes("adjust") ||
    rawMessage.includes("update") ||
    rawMessage.includes("modify") ||
    rawMessage.includes("ajouter") ||
    rawMessage.includes("agregar") ||
    rawMessage.includes("hinzufügen")
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
    rawMessage.includes("leren") ||
    rawMessage.includes("shorter") ||
    rawMessage.includes("clearer") ||
    rawMessage.includes("better") ||
    rawMessage.includes("learn") ||
    rawMessage.includes("improve") ||
    rawMessage.includes("response") ||
    rawMessage.includes("answer") ||
    rawMessage.includes("reply") ||
    rawMessage.includes("plus court") ||
    rawMessage.includes("más corto") ||
    rawMessage.includes("kürzer")
  ) {
    return "idea_feedback_learning";
  }

  return "idea_adjustment";
}

export async function POST(req: Request) {
  const rateLimit = await checkFeedbackRateLimit(req);

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
      { success: false, error: "Incorrect password" },
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

if (isAnalyticsWorkflowUpdate && !hasAnalyticsAccess) {
  return unauthorized("Analytics authorization required", rateLimit);
}

if (
  data.environment === "personal" &&
  !personalEnvironmentRequested &&
  !isAnalyticsWorkflowUpdate
) {
  return badRequest("Personal environment header required", rateLimit);
}

const canonicalEnvironment = resolveCanonicalRequestEnvironment({
  requestedEnvironment: data.environment,
  personalEnvironmentHeader: personalEnvironmentRequested,
  isAuthenticatedPersonalUser: identity.isAuthenticatedPersonalUser,
  isAnalyticsWorkflowUpdate,
});

if (!canonicalEnvironment) {
  return unauthorized("Personal feedback requires authentication", rateLimit);
}

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

if (
  !isAnalyticsWorkflowUpdate &&
  data.type === "auto_debug" &&
  !hasAnalyticsAccess
) {
  return unauthorized("Analytics authorization required", rateLimit);
}

if (
  !isAnalyticsWorkflowUpdate &&
  data.type === "auto_debug" &&
  data.environment === "personal"
) {
  return badRequest("Auto debug entries must use default environment", rateLimit);
}

const entry = buildCanonicalFeedbackEntry({
  data,
  identity,
  isAnalyticsWorkflowUpdate,
  canonicalEnvironment,
});

const persistedEntry = isAnalyticsWorkflowUpdate
  ? buildCanonicalWorkflowAdminEntry(entry)
  : entry;

try {
  let saved;

  if (data.action === "update_workflow_status") {
    const workflowHeaders = new Headers();
    workflowHeaders.set("Content-Type", "application/json");
    workflowHeaders.set("apikey", supabaseServiceRoleKey);
    workflowHeaders.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    workflowHeaders.set("Prefer", "return=representation");

    const workflowQuery =
      `type=eq.${encodeURIComponent(persistedEntry.type)}` +
      `&${buildPostgrestEqOrNullFilter("source", persistedEntry.source)}` +
      `&userScope=eq.${encodeURIComponent(persistedEntry.userScope)}` +
      `&environment=eq.${encodeURIComponent(persistedEntry.environment)}` +
      `&${buildPostgrestEqOrNullFilter("user_id", persistedEntry.user_id)}` +
      `&workflowKey=eq.${encodeURIComponent(persistedEntry.workflowKey)}`;

    const updateRes = await fetch(`${feedbackTableUrl}?${workflowQuery}`, {
      method: "PATCH",
      headers: workflowHeaders,
      body: JSON.stringify({
        message: persistedEntry.message,
        workflowStatus: persistedEntry.workflowStatus,
        timestamp: persistedEntry.timestamp,
        source: persistedEntry.source,
        environment: persistedEntry.environment,
        userScope: persistedEntry.userScope,
        user_id: persistedEntry.user_id,
        workflowKey: persistedEntry.workflowKey,
        learningType: persistedEntry.learningType,
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
        entry: persistedEntry,
        errorLabel: "Workflow status save failed:",
      });
    }
  } else {
    saved = await saveFeedbackEntry({
      feedbackTableUrl,
      supabaseServiceRoleKey,
      entry: persistedEntry,
      errorLabel: "Feedback save failed:",
    });
  }

  return NextResponse.json(
    {
      success: true,
      item: saved[0] ?? persistedEntry,
    },
    {
      headers: buildHeadersWithRateLimit(rateLimit),
    }
  );
} catch (error) {
  logSafeError("Feedback POST save failed", error, {
    action: data.action || "feedback",
    environment: persistedEntry.environment,
    userScope: persistedEntry.userScope,
    hasUserId: !!persistedEntry.user_id,
  });

  return NextResponse.json(
    {
      success: false,
     error:
          data.action === "update_workflow_status"
            ? "Workflow status save failed"
            : "Feedback save failed",
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
        error: "Feedback save failed",
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
          error: "Feedback fetch failed",
        },
        {
          status: 500,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const normalizedRows = Array.isArray(data)
      ? data
          .map((row) => {
            const mapped = mapFeedbackRowToApi(row as Record<string, unknown>);

            const resolvedEnvironment =
              mapped.environment === "personal" ? "personal" : "default";

            const resolvedUserScope =
              mapped.userScope === "admin" ||
              mapped.userScope === "guest" ||
              mapped.userScope === "personal" ||
              mapped.userScope === "user"
                ? mapped.userScope
                : resolvedEnvironment === "personal"
                ? "personal"
                : "guest";

            const resolvedType =
              mapped.type === "workflow_status" ||
              mapped.type === "up" ||
              mapped.type === "down" ||
              mapped.type === "improve" ||
              mapped.type === "idea" ||
              mapped.type === "auto_debug"
                ? mapped.type
                : null;

            const resolvedUserId =
              resolvedEnvironment === "personal" || resolvedUserScope === "user"
                ? typeof mapped.user_id === "string" && mapped.user_id
                  ? mapped.user_id
                  : null
                : mapped.user_id;

            return {
              ...mapped,
              type: resolvedType,
              environment: resolvedEnvironment,
              userScope: resolvedUserScope,
              user_id: resolvedUserId,
            };
          })
          .filter((row) => {
            if (!row.type) {
              return false;
            }

            if (row.type === "workflow_status") {
              return (
                row.source === "analytics_workflow" &&
                row.userScope === "admin" &&
                row.environment === "default" &&
                !!row.workflowKey &&
                !!row.workflowStatus
              );
            }

            if (row.environment === "default") {
              return (
                row.userScope === "admin" ||
                row.userScope === "guest" ||
                row.userScope === "user"
              );
            }

            return row.environment === "personal" && row.userScope === "personal";
          })
      : [];

return NextResponse.json(normalizedRows, {
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
        error: "Feedback fetch failed",
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
        error: "Analytics logout failed",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}