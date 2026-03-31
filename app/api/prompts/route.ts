import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const promptsTable = process.env.OPENLURA_PROMPTS_TABLE || "prompts";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_REQUEST_BYTES = 32 * 1024;
const MAX_USER_ID_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 300;
const MAX_CONTENT_LENGTH = 12000;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;

type PromptRow = {
  id?: string;
  user_id: string;
  name: string;
  description: string;
  content: string;
  tags?: string[] | null;
  created_at?: string;
  last_used_at?: string | null;
};

type CreatePromptBody = {
  name?: unknown;
  description?: unknown;
  content?: unknown;
  tags?: unknown;
};

function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized" },
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

function logSafeError(
  label: string,
  error: unknown,
  extra?: Record<string, unknown>
) {
  console.error(label, {
    ...extra,
    ...toSafeErrorMeta(error),
  });
}

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    promptsTableUrl: `${supabaseUrl}/rest/v1/${promptsTable}`,
    supabaseServiceRoleKey,
  };
}

function getRequestUserId(req: Request) {
  const raw = req.headers.get("x-openlura-user-id")?.trim() || "";

  if (!raw) return null;
  if (raw.length > MAX_USER_ID_LENGTH) return null;
  if (/[\r\n]/.test(raw)) return null;

  return raw;
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

function normalizeTags(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
}

function normalizeCreatePromptBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const candidate = body as CreatePromptBody;

  const name =
    typeof candidate.name === "string" ? candidate.name.trim() : "";
  const description =
    typeof candidate.description === "string"
      ? candidate.description.trim()
      : "";
  const content =
    typeof candidate.content === "string" ? candidate.content.trim() : "";
  const tags = normalizeTags(candidate.tags);

  if (!content) {
    return null;
  }

  const safeName = (name || content.slice(0, 60)).slice(0, MAX_NAME_LENGTH);

  if (!safeName) {
    return null;
  }

  return {
    name: safeName,
    description: description.slice(0, MAX_DESCRIPTION_LENGTH),
    content: content.slice(0, MAX_CONTENT_LENGTH),
    tags,
  };
}

async function insertPrompt(input: {
  promptsTableUrl: string;
  supabaseServiceRoleKey: string;
  row: PromptRow;
}) {
  const headers = new Headers();
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", "return=representation");
  headers.set("Accept", "application/json");

  const res = await fetch(input.promptsTableUrl, {
    method: "POST",
    headers,
    cache: "no-store",
    body: JSON.stringify(input.row),
  });

  if (!res.ok) {
    const errorText = await res.text();

    logSafeError("OpenLura prompt insert failed", new Error(errorText), {
      status: res.status,
    });

    return {
      ok: false as const,
      data: null,
    };
  }

  const data = (await res.json()) as PromptRow[];

  return {
    ok: true as const,
    data: Array.isArray(data) ? data[0] ?? null : null,
  };
}

async function fetchPrompts(input: {
  promptsTableUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
}) {
  const query =
    "select=id,name,description,content,tags,last_used_at,created_at" +
    `&user_id=eq.${encodeURIComponent(input.userId)}` +
    "&order=created_at.desc.nullslast";

  const headers = new Headers();
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Accept", "application/json");

  const res = await fetch(`${input.promptsTableUrl}?${query}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();

    logSafeError("OpenLura prompts fetch failed", new Error(errorText), {
      status: res.status,
    });

    return {
      ok: false as const,
      data: null,
    };
  }

  const data = (await res.json()) as PromptRow[];

  return {
    ok: true as const,
    data: Array.isArray(data) ? data : [],
  };
}

export async function POST(req: Request) {
  try {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > MAX_REQUEST_BYTES) {
      return badRequestResponse("Request too large");
    }

    const userId = getRequestUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const parsed = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

    if (!parsed.ok) {
      return badRequestResponse(
        parsed.reason === "too_large" ? "Request too large" : "Invalid JSON"
      );
    }

    const normalized = normalizeCreatePromptBody(parsed.body);

    if (!normalized) {
      return badRequestResponse("Invalid prompt payload");
    }

    const { promptsTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const insertResult = await insertPrompt({
      promptsTableUrl,
      supabaseServiceRoleKey,
      row: {
        user_id: userId,
        name: normalized.name,
        description: normalized.description,
        content: normalized.content,
        tags: normalized.tags,
      },
    });

    if (!insertResult.ok) {
  return internalErrorResponse("Failed to save prompt");
}

    return NextResponse.json(
      {
        success: true,
        prompt: insertResult.data,
      },
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
  logSafeError("OpenLura prompts POST failed", error);
  return internalErrorResponse("Failed to save prompt");
}
}

export async function GET(req: Request) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const { promptsTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const result = await fetchPrompts({
      promptsTableUrl,
      supabaseServiceRoleKey,
      userId,
    });

    if (!result.ok) {
  return internalErrorResponse("Failed to fetch prompts");
}

    return NextResponse.json(result.data, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
  logSafeError("OpenLura prompts GET failed", error);
  return internalErrorResponse("Failed to fetch prompts");
}
}