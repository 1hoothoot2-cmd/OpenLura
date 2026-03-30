import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

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
const MAX_CHAT_MESSAGES_PER_CHAT = 500;
const MAX_CHAT_TITLE_LENGTH = 300;
const MAX_MESSAGE_ROLE_LENGTH = 20;

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

function normalizePersonalMemory(memory: unknown[]) {
  const normalizedMemory = memory
    .filter((item) => isPlainObject(item))
    .map((item) => {
      const text =
        typeof item.text === "string" ? item.text.trim().slice(0, MAX_STRING_LENGTH) : "";
      const rawWeight = typeof item.weight === "number" ? item.weight : 0.5;
      const weight = Number.isFinite(rawWeight)
        ? Math.max(0.1, Math.min(rawWeight, 1))
        : 0.5;

      if (!text) {
        return null;
      }

      return {
        text,
        weight,
      };
    })
    .filter(
      (item): item is { text: string; weight: number } =>
        !!item
    )
    .slice(0, MAX_ITEMS_PER_COLLECTION);

  return normalizedMemory;
}

function normalizePersonalChats(chats: unknown[]) {
  const normalizedChats = chats
    .filter((chat) => isPlainObject(chat))
    .map((chat) => {
      const rawMessages = Array.isArray(chat.messages) ? chat.messages : [];

      const messages = rawMessages
        .filter((msg) => isPlainObject(msg))
        .map((msg) => {
          const role =
            typeof msg.role === "string"
              ? msg.role.trim().slice(0, MAX_MESSAGE_ROLE_LENGTH)
              : "";
          const content =
            typeof msg.content === "string"
              ? msg.content.slice(0, MAX_STRING_LENGTH)
              : "";
          const image =
            typeof msg.image === "string"
              ? msg.image.slice(0, MAX_STRING_LENGTH)
              : null;
          const variant =
            typeof msg.variant === "string"
              ? msg.variant.slice(0, 100)
              : undefined;
          const sources = Array.isArray(msg.sources) && isJsonSafeValue(msg.sources)
            ? msg.sources
            : undefined;
          const isStreaming = msg.isStreaming === true;
          const disableFeedback = msg.disableFeedback === true;

          if (!role) {
            return null;
          }

          return {
            role,
            content,
            image,
            ...(variant ? { variant } : {}),
            ...(sources ? { sources } : {}),
            ...(isStreaming ? { isStreaming: true } : {}),
            ...(disableFeedback ? { disableFeedback: true } : {}),
          };
        })
        .filter((msg): msg is NonNullable<typeof msg> => msg !== null)
        .slice(0, MAX_CHAT_MESSAGES_PER_CHAT);

      const normalizedId =
        typeof chat.id === "number" && Number.isFinite(chat.id)
          ? chat.id
          : Number(
              `${typeof chat.title === "string" ? chat.title.length : 0}${messages.length}`
            );

      const title =
        typeof chat.title === "string"
          ? chat.title.trim().slice(0, MAX_CHAT_TITLE_LENGTH)
          : "New Chat";

      return {
        id: normalizedId,
        title: title || "New Chat",
        messages,
        pinned: chat.pinned === true,
        archived: chat.archived === true,
        deleted: chat.deleted === true,
      };
    })
    .slice(0, MAX_ITEMS_PER_COLLECTION);

  return normalizedChats;
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
    chats: normalizePersonalChats(chats),
    memory: normalizePersonalMemory(memory),
  };
}

function getContentLength(req: Request) {
  const raw = req.headers.get("content-length");

  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  return Number(raw);
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

async function resolveAuthenticatedIdentity(
  req: Request
): Promise<AuthenticatedIdentity | null> {
  const result = await requireOpenLuraIdentity(req);

  if (!result.ok) {
    if (result.reason === "misconfigured") {
      logSafeError(
        "OpenLura personal state identity misconfigured",
        new Error("Identity enforcement misconfigured")
      );
    }

    return null;
  }

  return {
    accessToken: result.identity.accessToken,
    userId: result.identity.userId,
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
    const headers = new Headers();
    headers.set("apikey", input.supabaseAnonKey);
    headers.set("Authorization", `Bearer ${input.accessToken}`);
    headers.set("Accept", "application/json");

    const res = await fetch(`${input.personalStateTableUrl}?${query}`, {
      method: "GET",
      headers,
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

      return {
        ok: false,
        reason: "error",
      };
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
    const normalizedChats = Array.isArray(row?.chats)
      ? normalizePersonalChats(row.chats)
      : [];
    const normalizedMemory = Array.isArray(row?.memory)
      ? normalizePersonalMemory(row.memory)
      : [];

    return NextResponse.json(
      {
        chats: normalizedChats,
        memory: normalizedMemory,
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

    const parsedBody = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

    if (!parsedBody.ok) {
      if (parsedBody.reason === "too_large") {
        return badRequestResponse("Request body too large");
      }

      return badRequestResponse("Invalid request body");
    }

    const body = validatePersonalStateBody(parsedBody.body);

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

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseAnonKey);
    headers.set("Authorization", `Bearer ${identity.accessToken}`);
    headers.set("Prefer", "resolution=merge-duplicates,return=representation");

    const res = await fetch(`${personalStateTableUrl}?on_conflict=user_id`, {
      method: "POST",
      headers,
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

    const savedRows: unknown = await res.json();
    const savedRow =
      Array.isArray(savedRows) && isPlainObject(savedRows[0]) ? savedRows[0] : null;

    return NextResponse.json(
      {
        success: true,
        chats: Array.isArray(savedRow?.chats)
          ? normalizePersonalChats(savedRow.chats)
          : body.chats,
        memory: Array.isArray(savedRow?.memory)
          ? normalizePersonalMemory(savedRow.memory)
          : body.memory,
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