import { NextResponse } from "next/server";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_ITEMS_PER_COLLECTION = 500;
const MAX_REQUEST_BYTES = 1024 * 1024;

type PersonalStateBody = {
  chats: unknown[];
  memory: unknown[];
};

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    personalStateTableUrl: `${supabaseUrl}/rest/v1/${personalStateTable}`,
    supabaseServiceRoleKey,
  };
}

function unauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: NO_STORE_HEADERS,
    }
  );
}

function badRequestResponse(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 400,
      headers: NO_STORE_HEADERS,
    }
  );
}

function internalErrorResponse(message: string) {
  return NextResponse.json(
    { success: false, error: message },
    {
      status: 500,
      headers: NO_STORE_HEADERS,
    }
  );
}

function isPlainObject(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validatePersonalStateBody(body: unknown): PersonalStateBody | null {
  if (!isPlainObject(body)) {
    return null;
  }

  const candidate = body as {
    chats?: unknown;
    memory?: unknown;
  };

  const chats = Array.isArray(candidate.chats) ? candidate.chats : null;
  const memory = Array.isArray(candidate.memory) ? candidate.memory : null;

  if (!chats || !memory) {
    return null;
  }

  if (
    chats.length > MAX_ITEMS_PER_COLLECTION ||
    memory.length > MAX_ITEMS_PER_COLLECTION
  ) {
    return null;
  }

  return {
    chats,
    memory,
  };
}

async function resolveAuthenticatedUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.userId;
}

async function fetchPersonalStateRow(input: {
  personalStateTableUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
}) {
  const query =
    `select=chats,memory,updated_at` +
    `&user_id=eq.${encodeURIComponent(input.userId)}` +
    `&order=updated_at.desc.nullslast` +
    `&limit=1`;

  try {
    const res = await fetch(`${input.personalStateTableUrl}?${query}`, {
      method: "GET",
      headers: {
        apikey: input.supabaseServiceRoleKey,
        Authorization: `Bearer ${input.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const rows: unknown = await res.json();

    if (!Array.isArray(rows)) {
      return null;
    }

    return rows[0] ?? null;
  } catch (error) {
    console.error("Personal state row fetch failed");
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const userId = await resolveAuthenticatedUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const row = await fetchPersonalStateRow({
      personalStateTableUrl,
      supabaseServiceRoleKey,
      userId,
    });

    return NextResponse.json(
      {
        chats: Array.isArray((row as { chats?: unknown })?.chats)
          ? (row as { chats: unknown[] }).chats
          : [],
        memory: Array.isArray((row as { memory?: unknown })?.memory)
          ? (row as { memory: unknown[] }).memory
          : [],
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Load failed" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    const userId = await resolveAuthenticatedUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const contentLengthHeader = req.headers.get("content-length");
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

    if (
      contentLength !== null &&
      Number.isFinite(contentLength) &&
      contentLength > MAX_REQUEST_BYTES
    ) {
      return badRequestResponse("Request body too large");
    }

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return badRequestResponse("Invalid request body");
    }

    const body = validatePersonalStateBody(rawBody);

    if (!body) {
      return badRequestResponse("Invalid personal state payload");
    }

    const { personalStateTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const payload = {
      user_id: userId,
      chats: body.chats,
      memory: body.memory,
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
      return internalErrorResponse(errorText || "Save failed");
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Save failed" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}