import { NextResponse } from "next/server";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const personalStateTable =
  process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_ITEMS_PER_COLLECTION = 500;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_JSON_DEPTH = 12;
const MAX_STRING_LENGTH = 100_000;

type PersonalStateBody = {
  chats: unknown[];
  memory: unknown[];
};

type AuthenticatedIdentity = {
  accessToken: string;
  userId: string;
};

type FetchPersonalStateResult =
  | {
      ok: true;
      row: { chats?: unknown; memory?: unknown; updated_at?: unknown } | null;
    }
  | {
      ok: false;
      reason: "unauthorized" | "error";
    };

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

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return {
    personalStateTableUrl: `${supabaseUrl}/rest/v1/${personalStateTable}`,
    supabaseAnonKey,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonSafeValue(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) {
    return false;
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return Number.isFinite(value as number) || typeof value !== "number";
  }

  if (typeof value === "string") {
    return value.length <= MAX_STRING_LENGTH;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isJsonSafeValue(item, depth + 1));
  }

  if (isPlainObject(value)) {
    return Object.entries(value).every(([key, nestedValue]) => {
      if (key.length > 500) {
        return false;
      }

      return isJsonSafeValue(nestedValue, depth + 1);
    });
  }

  return false;
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

  if (!isJsonSafeValue(chats) || !isJsonSafeValue(memory)) {
    return null;
  }

  return {
    chats,
    memory,
  };
}

function getContentLength(req: Request) {
  const raw = req.headers.get("content-length");

  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  return Number(raw);
}

async function resolveAuthenticatedIdentity(
  req: Request
): Promise<AuthenticatedIdentity | null> {
  const identity = await resolveOpenLuraRequestIdentity(req);

  if (!identity.accessToken || !identity.userId) {
    return null;
  }

  return {
    accessToken: identity.accessToken,
    userId: identity.userId,
  };
}

async function fetchPersonalStateRow(input: {
  personalStateTableUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  userId: string;
}): Promise<FetchPersonalStateResult> {
  const query =
    `select=chats,memory,updated_at` +
    `&user_id=eq.${encodeURIComponent(input.userId)}` +
    `&order=updated_at.desc.nullslast` +
    `&limit=2`;

  try {
    const res = await fetch(`${input.personalStateTableUrl}?${query}`, {
      method: "GET",
      headers: {
        apikey: input.supabaseAnonKey,
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        reason: "unauthorized",
      };
    }

    if (!res.ok) {
      const errorText = await res.text();

      logSafeError("OpenLura personal state fetch failed", new Error(errorText), {
        status: res.status,
      });

      return {
        ok: false,
        reason: "error",
      };
    }

    const rows: unknown = await res.json();

    if (!Array.isArray(rows)) {
      return {
        ok: false,
        reason: "error",
      };
    }

    if (rows.length > 1) {
      logSafeError(
        "OpenLura personal state anomaly: multiple rows for one user",
        new Error("Multiple rows returned"),
        {
          rowCount: rows.length,
          userIdPresent: !!input.userId,
        }
      );
    }

    const firstRow = rows[0];

    if (firstRow !== undefined && !isPlainObject(firstRow)) {
      return {
        ok: false,
        reason: "error",
      };
    }

    return {
      ok: true,
      row: (firstRow as { chats?: unknown; memory?: unknown; updated_at?: unknown } | undefined) ?? null,
    };
  } catch (error) {
    logSafeError("OpenLura personal state fetch failed", error);
    return {
      ok: false,
      reason: "error",
    };
  }
}

export async function GET(req: Request) {
  try {
    const identity = await resolveAuthenticatedIdentity(req);

    if (!identity) {
      return unauthorizedResponse();
    }

    const { personalStateTableUrl, supabaseAnonKey } = getSupabaseConfig();

    const result = await fetchPersonalStateRow({
      personalStateTableUrl,
      supabaseAnonKey,
      accessToken: identity.accessToken,
      userId: identity.userId,
    });

    if (!result.ok && result.reason === "unauthorized") {
      return unauthorizedResponse();
    }

    if (!result.ok) {
      return internalErrorResponse("Load failed");
    }

    const row = result.row;

    return NextResponse.json(
      {
        chats: Array.isArray(row?.chats) ? row.chats : [],
        memory: Array.isArray(row?.memory) ? row.memory : [],
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logSafeError("OpenLura personal state GET failed", error);

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
    const identity = await resolveAuthenticatedIdentity(req);

    if (!identity) {
      return unauthorizedResponse();
    }

    const contentLength = getContentLength(req);

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

    const { personalStateTableUrl, supabaseAnonKey } = getSupabaseConfig();

    const payload = {
      user_id: identity.userId,
      chats: body.chats,
      memory: body.memory,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${personalStateTableUrl}?on_conflict=user_id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${identity.accessToken}`,
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) {
      return unauthorizedResponse();
    }

    if (!res.ok) {
      const errorText = await res.text();

      logSafeError("OpenLura personal state save failed", new Error(errorText), {
        status: res.status,
      });

      return internalErrorResponse("Save failed");
    }

    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logSafeError("OpenLura personal state save failed", error);

    return NextResponse.json(
      { error: "Save failed" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}