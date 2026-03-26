import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_COOKIE_NAME = "openlura_admin_session";
const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "openlura-admin-session-secret";

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

function assertAdmin(req: Request) {
  const sessionCookie = getCookieValue(req, ADMIN_COOKIE_NAME);

  if (!isValidAdminSession(sessionCookie)) {
    throw new Error("Unauthorized");
  }
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    personalStateTableUrl: `${supabaseUrl}/rest/v1/openlura_personal_state`,
    supabaseServiceRoleKey,
  };
}

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const res = await fetch(
      `${personalStateTableUrl}?select=chats,memory&key=eq.primary&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return NextResponse.json({ chats: [], memory: [] }, { status: 200 });
    }

    const rows = await res.json();
    const row = rows?.[0];

    return NextResponse.json(
      {
        chats: Array.isArray(row?.chats) ? row.chats : [],
        memory: Array.isArray(row?.memory) ? row.memory : [],
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Load failed" },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    assertAdmin(req);
    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const body = await req.json();

    const payload = {
      key: "primary",
      chats: Array.isArray(body?.chats) ? body.chats : [],
      memory: Array.isArray(body?.memory) ? body.memory : [],
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(personalStateTableUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();

      return NextResponse.json(
        { success: false, error: errorText || "Save failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: message === "Unauthorized" ? "Unauthorized" : "Save failed" },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}