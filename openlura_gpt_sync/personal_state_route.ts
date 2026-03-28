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
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

async function resolvePersonalStateIdentity(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);

  const adminSession = isValidAdminSession(
    getCookieValue(req, ADMIN_COOKIE_NAME)
  );

  const userId = identity.authUser?.id || (adminSession ? "primary" : null);

  return {
    userId,
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
  const newestRowOrder = "&order=updated_at.desc.nullslast&limit=1";

  const queries = input.userId
    ? [
        `select=chats,memory,user_id,key,updated_at&user_id=eq.${encodeURIComponent(input.userId)}${newestRowOrder}`,
        `select=chats,memory,user_id,key,updated_at&id=eq.${encodeURIComponent(input.userId)}${newestRowOrder}`,
        `select=chats,memory,user_id,key,updated_at&key=eq.${encodeURIComponent(input.userId)}${newestRowOrder}`,
        `select=chats,memory,user_id,key,updated_at&key=eq.primary${newestRowOrder}`,
      ]
    : [`select=chats,memory,user_id,key,updated_at&key=eq.primary${newestRowOrder}`];

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
          storageKey: row?.key || null,
          updatedAt: row?.updated_at || null,
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

    const isPersonalWrite = !!userId;
const storageKey = isPersonalWrite ? userId : "primary";

const payload = {
  key: storageKey,
  user_id: isPersonalWrite ? userId : null,
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
          storageKey,
          updatedAt: payload.updated_at,
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