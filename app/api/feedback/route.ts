import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  getCookieValue,
  isValidAdminSession,
} from "@/lib/auth/adminSession";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const analyticsAdminPassword =
  process.env.ANALYTICS_ADMIN_PASSWORD || "@Bodi2023!@#";
const analyticsSessionSecret =
  process.env.ANALYTICS_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "openlura-analytics-session-secret";
const ANALYTICS_COOKIE_NAME = "openlura_analytics_session";
const ANALYTICS_SESSION_MAX_AGE = 60 * 60 * 3;

async function resolveFeedbackUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  const isAdmin = isValidAdminSession(
    getCookieValue(req, ADMIN_COOKIE_NAME)
  );
  const isPersonalEnvironment =
    req.headers.get("x-openlura-personal-env") === "true";

  return (
    identity.authUser?.id ||
    (isAdmin && isPersonalEnvironment ? "primary" : identity.headerUserId) ||
    null
  );
}

function signAnalyticsSession(expiresAt: string) {
  return createHmac("sha256", analyticsSessionSecret)
    .update(expiresAt)
    .digest("hex");
}

function getUserScopeFromRequest(req: Request) {
  return isValidAdminSession(getCookieValue(req, ADMIN_COOKIE_NAME))
    ? "admin"
    : "guest";
}

function createAnalyticsSessionValue() {
  const expiresAt = String(Date.now() + ANALYTICS_SESSION_MAX_AGE * 1000);
  const signature = signAnalyticsSession(expiresAt);
  return `${expiresAt}.${signature}`;
  
}
function isValidAnalyticsSession(value?: string | null) {
  if (!value) return false;

  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) <= Date.now()) return false;

  const expected = signAnalyticsSession(expiresAt);

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
function getAnalyticsSessionCookie(req: Request) {
  return getCookieValue(req, ANALYTICS_COOKIE_NAME);
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

function isFeedbackSchemaMismatch(status: number, errorText: string) {
  return (
    status === 400 &&
    (
      errorText.includes("PGRST204") ||
      errorText.includes("42703") ||
      errorText.toLowerCase().includes("user_id") ||
      errorText.toLowerCase().includes("column") ||
      errorText.toLowerCase().includes("could not find the")
    )
  );
}

async function saveFeedbackEntry(input: {
  feedbackTableUrl: string;
  supabaseServiceRoleKey: string;
  entry: Record<string, any>;
  errorLabel: string;
}) {
  let res = await fetch(input.feedbackTableUrl, {
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

    if (isFeedbackSchemaMismatch(res.status, errorText)) {
      const { user_id, userScope, environment, ...fallbackEntry } = input.entry;

      res = await fetch(input.feedbackTableUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: input.supabaseServiceRoleKey,
          Authorization: `Bearer ${input.supabaseServiceRoleKey}`,
          Prefer: "return=representation",
        } as HeadersInit,
        body: JSON.stringify(fallbackEntry),
        cache: "no-store",
      });
    } else {
      throw new Error(`${input.errorLabel} ${res.status}: ${errorText}`);
    }
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`${input.errorLabel} fallback ${res.status}: ${errorText}`);
  }

  return await res.json();
}

export async function POST(req: Request) {
  try {
    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const data = await req.json();
    const userScope = getUserScopeFromRequest(req);
    const resolvedUserId = await resolveFeedbackUserId(req);
    const isExplicitPersonalEnvironment =
      req.headers.get("x-openlura-personal-env") === "true" ||
      data?.environment === "personal";
    const isPersonalEnvironment = isExplicitPersonalEnvironment;

    if (data?.action === "unlock_analytics") {
      if (String(data.password ?? "") !== analyticsAdminPassword) {
        return NextResponse.json(
          { success: false, error: "Verkeerd wachtwoord" },
          { status: 401 }
        );
      }

      const response = NextResponse.json(
        { success: true },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );

      response.cookies.set(ANALYTICS_COOKIE_NAME, createAnalyticsSessionValue(), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: ANALYTICS_SESSION_MAX_AGE,
      });

      return response;
    }

        if (data?.action === "update_workflow_status") {
          const entry = {
            chatId: data.chatId ?? null,
            msgIndex: data.msgIndex ?? null,
            type: data.type ?? null,
            message: data.message ?? null,
            userMessage: data.userMessage ?? null,
            source: data.source ?? null,
            userScope: isPersonalEnvironment ? "personal" : userScope,
            user_id: resolvedUserId,
            environment: isPersonalEnvironment ? "personal" : "default",
            timestamp: new Date().toISOString(),
          };

          try {
            const saved = await saveFeedbackEntry({
              feedbackTableUrl,
              supabaseServiceRoleKey,
              entry,
              errorLabel: "Workflow status opslaan mislukt:",
            });

            return NextResponse.json(
              { success: true, item: saved?.[0] ?? entry },
              {
                headers: {
                  "Cache-Control": "no-store",
                },
              }
            );
          } catch (error) {
            console.error("Supabase workflow POST failed:", error);

            return NextResponse.json(
              {
                success: false,
                error: "Workflow status opslaan mislukt",
                details: String(error),
              },
              { status: 500 }
            );
          }
        }

    const rawMessage = String(data.message ?? "").toLowerCase();

    let inferredIdeaSource = data.source ?? null;

    if (data.type === "idea") {
      if (
        rawMessage.includes("bug") ||
        rawMessage.includes("werkt niet") ||
        rawMessage.includes("error") ||
        rawMessage.includes("fout") ||
        rawMessage.includes("crash") ||
        rawMessage.includes("stuk") ||
        rawMessage.includes("kapot")
      ) {
        inferredIdeaSource = "idea_bug";
      } else if (
        rawMessage.includes("aanpassen") ||
        rawMessage.includes("aanpassing") ||
        rawMessage.includes("toevoegen") ||
        rawMessage.includes("maak") ||
        rawMessage.includes("zet") ||
        rawMessage.includes("verander") ||
        rawMessage.includes("wijzig")
      ) {
        inferredIdeaSource = "idea_adjustment";
      } else if (
        rawMessage.includes("ai") ||
        rawMessage.includes("antwoord") ||
        rawMessage.includes("reageer") ||
        rawMessage.includes("korter") ||
        rawMessage.includes("duidelijker") ||
        rawMessage.includes("beter") ||
        rawMessage.includes("leren")
      ) {
        inferredIdeaSource = "idea_feedback_learning";
      } else {
        inferredIdeaSource = "idea_adjustment";
      }
    }
    const entry = {
      chatId: data.chatId ?? null,
      msgIndex: data.msgIndex ?? null,
      type: data.type ?? null,
      message: data.message ?? null,
      userMessage: data.userMessage ?? null,
      source: data.type === "idea" ? inferredIdeaSource : data.source ?? null,
      userScope: isPersonalEnvironment ? "personal" : userScope,
      user_id: resolvedUserId,
      environment: isPersonalEnvironment ? "personal" : "default",
      timestamp: new Date().toISOString(),
    };

    let saved;

    try {
      saved = await saveFeedbackEntry({
        feedbackTableUrl,
        supabaseServiceRoleKey,
        entry,
        errorLabel: "Feedback opslaan mislukt:",
      });
    } catch (error) {
      console.error("Supabase POST failed:", error);

      return NextResponse.json(
        {
          success: false,
          error: "Feedback opslaan mislukt",
          details: String(error),
        },
        { status: 500 }
      );
    }

   return NextResponse.json(
      {
        success: true,
        item: saved?.[0] ?? entry,
        runtime: {
          userId: resolvedUserId,
          personal: isPersonalEnvironment,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Feedback POST failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Feedback opslaan mislukt",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const sessionCookie = getAnalyticsSessionCookie(req);

    if (!isValidAnalyticsSession(sessionCookie)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
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
          supabaseStatus: res.status,
          supabaseError: errorText,
        },
        { status: 500 }
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
        details: String(error),
      },
      { status: 500 }
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
          clearedSession: hadSession,
          sessionType: "analytics_admin",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    response.cookies.set(ANALYTICS_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error("Feedback DELETE failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Analytics logout mislukt",
        details: String(error),
      },
      { status: 500 }
    );
  }
}