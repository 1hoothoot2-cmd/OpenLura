import {
  ANALYTICS_COOKIE_NAME,
  createAnalyticsSessionValue,
  getAnalyticsSessionCookie,
  getAnalyticsSessionCookieOptions,
  getClearedAnalyticsSessionCookieOptions,
  isValidAnalyticsSession,
} from "@/lib/auth/analyticsSession";
import { NextResponse } from "next/server";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const analyticsAdminPassword = process.env.ANALYTICS_ADMIN_PASSWORD;
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
type FeedbackType = string | null;

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
    supabaseServiceRoleKey,
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
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
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
    type: normalizeOptionalString(body.type, 100),
    message: normalizeOptionalString(body.message),
    userMessage: normalizeOptionalString(body.userMessage),
    source: normalizeOptionalString(body.source, 100),
    environment: normalizeOptionalString(body.environment, 50),
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
  const identity = await resolveOpenLuraRequestIdentity(req);

  return {
    userId: identity.userId,
    isAuthenticatedPersonalUser: !!identity.userId,
  };
}

async function saveFeedbackEntry(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  entry: Record<string, unknown>;
  errorLabel: string;
}) {
  const res = await fetch(input.feedbackTableUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: input.supabaseServiceRoleKey,
      Authorization: `Bearer ${input.supabaseServiceRoleKey}`,
      Prefer: "return=representation",
    } as HeadersInit,
    body: JSON.stringify(input.entry),
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${input.errorLabel} ${res.status}: ${errorText}`);
  }

  const data: unknown = await res.json();
  return Array.isArray(data) ? data : [];
}

function inferIdeaSource(
  type: string | null,
  message: string | null,
  source: string | null
) {
  if (type !== "idea") {
    return source;
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

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return badRequest("Invalid request body", rateLimit);
    }

    const data = parseFeedbackRequestBody(rawBody);

    if (!data) {
      return badRequest("Invalid request body", rateLimit);
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

      if ((data.password || "") !== analyticsAdminPassword) {
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
    const wantsPersonalEnvironment = data.environment === "personal";
    const isPersonalEnvironment =
      identity.isAuthenticatedPersonalUser && wantsPersonalEnvironment;

    if (wantsPersonalEnvironment && !identity.isAuthenticatedPersonalUser) {
      return unauthorized("Personal feedback requires authentication", rateLimit);
    }

    if (data.action === "update_workflow_status" && !isFeedbackReadAuthorized(req)) {
      return unauthorized("Analytics authorization required", rateLimit);
    }

    const entry = {
      chatId: data.chatId,
      msgIndex: data.msgIndex,
      type: data.type,
      message: data.message,
      userMessage: data.userMessage,
      source: inferIdeaSource(data.type, data.message, data.source),
      userScope: isPersonalEnvironment ? "personal" : "guest",
      user_id: identity.userId,
      environment: isPersonalEnvironment ? "personal" : "default",
      timestamp: new Date().toISOString(),
    };

    try {
      const saved = await saveFeedbackEntry({
        feedbackTableUrl,
        supabaseServiceRoleKey,
        entry,
        errorLabel:
          data.action === "update_workflow_status"
            ? "Workflow status opslaan mislukt:"
            : "Feedback opslaan mislukt:",
      });

      return NextResponse.json(
        {
          success: true,
          item: saved[0] ?? entry,
        },
        {
          headers: buildHeadersWithRateLimit(rateLimit),
        }
      );
    } catch (error) {
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
      "select=chatId,msgIndex,type,message,userMessage,source,userScope,user_id,environment,timestamp" +
      "&order=timestamp.desc";

    const res = await fetch(`${feedbackTableUrl}?${query}`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
      } as HeadersInit,
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();

      logSafeError("Supabase feedback GET failed", new Error(errorText), {
        status: res.status,
      });

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

    const data = await res.json();

    return NextResponse.json(data, {
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