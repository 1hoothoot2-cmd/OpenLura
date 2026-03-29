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

function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 400,
      headers: NO_STORE_HEADERS,
    }
  );
}

function unauthorized(message = "Unauthorized") {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 401,
      headers: NO_STORE_HEADERS,
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

function inferIdeaSource(type: string | null, message: string | null, source: string | null) {
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
  try {
    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return badRequest("Invalid request body");
    }

    const data = parseFeedbackRequestBody(rawBody);

    if (!data) {
      return badRequest("Invalid request body");
    }

    if (data.action === "unlock_analytics") {
      if (!analyticsAdminPassword) {
        return NextResponse.json(
          { success: false, error: "Analytics auth not configured" },
          {
            status: 500,
            headers: NO_STORE_HEADERS,
          }
        );
      }

      if ((data.password || "") !== analyticsAdminPassword) {
        return NextResponse.json(
          { success: false, error: "Verkeerd wachtwoord" },
          {
            status: 401,
            headers: NO_STORE_HEADERS,
          }
        );
      }

      const response = NextResponse.json(
        {
          success: true,
        },
        {
          headers: NO_STORE_HEADERS,
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
    const isPersonalEnvironment =
      identity.isAuthenticatedPersonalUser && data.environment === "personal";

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
          headers: NO_STORE_HEADERS,
        }
      );
    } catch (error) {
      console.error("Feedback POST failed:", error);

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
          headers: NO_STORE_HEADERS,
        }
      );
    }
  } catch (error) {
    console.error("Feedback POST failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Feedback opslaan mislukt",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
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

    const res = await fetch(
      `${feedbackTableUrl}?select=*&order=timestamp.desc`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        } as HeadersInit,
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase GET failed:", res.status, errorText);

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
    console.error("Feedback GET failed:", error);

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
    console.error("Feedback DELETE failed:", error);

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