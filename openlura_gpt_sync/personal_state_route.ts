import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  getCookieValue,
  isValidAdminSession,
} from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

function getBearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const directCookie =
    getCookieValue(req, "sb-access-token") ||
    getCookieValue(req, "supabase-access-token");

  if (directCookie) return decodeURIComponent(directCookie);

  const packedCookie =
    getCookieValue(req, "supabase-auth-token") ||
    getCookieValue(req, "sb-auth-token");

  if (!packedCookie) return null;

  try {
    const decoded = decodeURIComponent(packedCookie);
    const parsed = JSON.parse(decoded);

    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    if (typeof parsed?.access_token === "string") return parsed.access_token;
  } catch {}

  return null;
}

async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !accessToken) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    return await res.json();
  } catch (error) {
    console.error("Personal state auth user fetch failed:", error);
    return null;
  }
}

async function resolvePersonalStateIdentity(req: Request) {
  const accessToken = getBearerTokenFromRequest(req);
  const authUser = await fetchSupabaseAuthUser(accessToken);
  const headerUserId =
    req.headers.get("x-openlura-user-id") ||
    req.headers.get("x-user-id");

  const adminSession = isValidAdminSession(getCookieValue(req, ADMIN_COOKIE_NAME));

  return {
    userId: authUser?.id || headerUserId || null,
    isAdmin: adminSession,
  };
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    personalStateTableUrl: `${supabaseUrl}/rest/v1/${personalStateTable}`,
    supabaseServiceRoleKey,
  };
}

async function fetchPersonalStateRow(input: {
  personalStateTableUrl: string;
  supabaseServiceRoleKey: string;
  userId?: string | null;
}) {
  const queries = input.userId
    ? [
        `select=chats,memory,user_id,key&user_id=eq.${encodeURIComponent(input.userId)}&limit=1`,
        `select=chats,memory,user_id,key&id=eq.${encodeURIComponent(input.userId)}&limit=1`,
        `select=chats,memory,user_id,key&key=eq.${encodeURIComponent(input.userId)}&limit=1`,
        "select=chats,memory,user_id,key&key=eq.primary&limit=1",
      ]
    : ["select=chats,memory,user_id,key&key=eq.primary&limit=1"];

  for (const query of queries) {
    try {
      const res = await fetch(`${input.personalStateTableUrl}?${query}`, {
        method: "GET",
        headers: {
          apikey: input.supabaseServiceRoleKey,
          Authorization: `Bearer ${input.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      });

      if (!res.ok) continue;

      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : null;

      if (row) return row;
    } catch (error) {
      console.error("Personal state row fetch failed:", error);
    }
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const { userId, isAdmin } = await resolvePersonalStateIdentity(req);

    if (!userId && !isAdmin) {
      throw new Error("Unauthorized");
    }

    const row = await fetchPersonalStateRow({
      personalStateTableUrl,
      supabaseServiceRoleKey,
      userId,
    });

    return NextResponse.json(
      {
        chats: Array.isArray(row?.chats) ? row.chats : [],
        memory: Array.isArray(row?.memory) ? row.memory : [],
        runtime: {
          userId: userId || null,
          mode: userId ? "personal" : "legacy_admin",
        },
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
    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const body = await req.json();
    const { userId, isAdmin } = await resolvePersonalStateIdentity(req);

    if (!userId && !isAdmin) {
      throw new Error("Unauthorized");
    }

    const payload = {
      key: userId || "primary",
      user_id: userId || null,
      chats: Array.isArray(body?.chats) ? body.chats : [],
      memory: Array.isArray(body?.memory) ? body.memory : [],
      updated_at: new Date().toISOString(),
    };

    let res = await fetch(personalStateTableUrl, {
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
      const isSchemaMismatch =
        res.status === 400 &&
        (
          errorText.includes("PGRST204") ||
          errorText.includes("42703") ||
          errorText.toLowerCase().includes("user_id") ||
          errorText.toLowerCase().includes("column") ||
          errorText.toLowerCase().includes("could not find the")
        );

      if (isSchemaMismatch) {
        const { user_id, ...fallbackPayload } = payload;

        res = await fetch(personalStateTableUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseServiceRoleKey,
            Authorization: `Bearer ${supabaseServiceRoleKey}`,
            Prefer: "resolution=merge-duplicates,return=representation",
          },
          body: JSON.stringify(fallbackPayload),
          cache: "no-store",
        });
      } else {
        return NextResponse.json(
          { success: false, error: errorText || "Save failed" },
          { status: 500 }
        );
      }
    }

    if (!res.ok) {
      const errorText = await res.text();

      return NextResponse.json(
        { success: false, error: errorText || "Save failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        runtime: {
          userId: userId || null,
          mode: userId ? "personal" : "legacy_admin",
        },
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
      { error: message === "Unauthorized" ? "Unauthorized" : "Save failed" },
      { status: message === "Unauthorized" ? 401 : 500 }
    );
  }
}