import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

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
const ADMIN_COOKIE_NAME = "openlura_admin_session";
const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "openlura-admin-session-secret";

function signAnalyticsSession(expiresAt: string) {
  return createHmac("sha256", analyticsSessionSecret)
    .update(expiresAt)
    .digest("hex");
}

function signAdminSession(expiresAt: string) {
  return createHmac("sha256", adminSessionSecret).update(expiresAt).digest("hex");
}

function isValidAdminSession(value?: string | null) {
  if (!value) return false;

  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) <= Date.now()) return false;

  const expected = signAdminSession(expiresAt);

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

function getCookieValue(req: Request, name: string) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? null
  );
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

  return signAnalyticsSession(expiresAt) === signature;
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

export async function POST(req: Request) {
  try {
    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const data = await req.json();
    const userScope = getUserScopeFromRequest(req);

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
        type: "workflow_status",
        message: data.status ?? null,
        userMessage: data.itemKey ?? null,
        source: "analytics_workflow",
        userScope,
        timestamp: new Date().toISOString(),
      };

      const res = await fetch(feedbackTableUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          Prefer: "return=representation",
        } as HeadersInit,
        body: JSON.stringify(entry),
        cache: "no-store",
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Supabase workflow POST failed:", res.status, errorText);

        return NextResponse.json(
          {
            success: false,
            error: "Workflow status opslaan mislukt",
            supabaseStatus: res.status,
            supabaseError: errorText,
          },
          { status: 500 }
        );
      }

      const saved = await res.json();

      return NextResponse.json(
        { success: true, item: saved?.[0] ?? entry },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
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
      source: inferredIdeaSource,
      learningType: data.learningType ?? null,
      userScope,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(feedbackTableUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      } as HeadersInit,
      body: JSON.stringify(entry),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase POST failed:", res.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: "Feedback opslaan mislukt",
          supabaseStatus: res.status,
          supabaseError: errorText,
        },
        { status: 500 }
      );
    }

    const saved = await res.json();

   return NextResponse.json(
      { success: true, item: saved?.[0] ?? entry },
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
    const sessionCookie =
      req.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${ANALYTICS_COOKIE_NAME}=`))
        ?.split("=")[1] ?? null;

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