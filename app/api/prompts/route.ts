import { NextResponse } from "next/server";
import { getBearerTokenFromRequest } from "@/lib/auth/requestIdentity";

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
  tags?: string[];
  created_at?: string;
  last_used_at?: string | null;
};

type CreatePromptBody = {
  name?: unknown;
  description?: unknown;
  content?: unknown;
  tags?: unknown;
};

type DeletePromptBody = {
  id?: unknown;
};

type UpdatePromptBody = {
  id?: unknown;
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

function decodeJwtUserId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const sub = typeof payload?.sub === "string" ? payload.sub.trim() : null;
    if (!sub || sub.length > MAX_USER_ID_LENGTH) return null;
    return sub;
  } catch {
    return null;
  }
}

async function getRequestUserId(req: Request) {
  const token = getBearerTokenFromRequest(req);
  if (token) {
    // Verify token with Supabase — do not trust JWT decode alone
    if (supabaseUrl && supabaseServiceRoleKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        let verifiedId: string | null = null;
        try {
          const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              apikey: supabaseServiceRoleKey,
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
            signal: controller.signal,
          });
          if (res.ok) {
            const data: unknown = await res.json();
            if (data && typeof data === "object" && !Array.isArray(data)) {
              const id = (data as Record<string, unknown>).id;
              if (typeof id === "string" && id.trim()) verifiedId = id.trim();
            }
          }
        } finally {
          clearTimeout(timeoutId);
        }
        if (verifiedId) return verifiedId;
      } catch {
        // verification failed — fall through to null
      }
    } else {
      // No Supabase config — fall back to JWT decode only
      const jwtUserId = decodeJwtUserId(token);
      if (jwtUserId) return jwtUserId;
    }
  }

  // Never trust x-openlura-user-id header for write operations
  // Only allow for non-auth scenarios (anon prompt read — currently unused)
  return null;
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

  const normalized = input
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));

  const uniqueTags: string[] = [];

  for (const tag of normalized) {
    const exists = uniqueTags.some(
      (existingTag) => existingTag.toLowerCase() === tag.toLowerCase()
    );

    if (exists) continue;
    if (uniqueTags.length >= MAX_TAGS) break;

    uniqueTags.push(tag);
  }

  return uniqueTags;
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

function normalizeDeletePromptBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const candidate = body as DeletePromptBody;
  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";

  if (!id || id.length > 200 || /[\r\n]/.test(id)) {
    return null;
  }

  return { id };
}

function normalizeUpdatePromptBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const candidate = body as UpdatePromptBody;

  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const rawName =
    typeof candidate.name === "string" ? candidate.name.trim() : "";
  const rawDescription =
    typeof candidate.description === "string"
      ? candidate.description.trim()
      : "";
  const rawContent =
    typeof candidate.content === "string" ? candidate.content.trim() : "";
  const tags = normalizeTags(candidate.tags);

  if (!id || id.length > 200 || /[\r\n]/.test(id)) {
    return null;
  }

  if (!rawContent) {
    return null;
  }

  const safeName = (rawName || rawContent.slice(0, 60)).slice(0, MAX_NAME_LENGTH);

  if (!safeName) {
    return null;
  }

  return {
    id,
    name: safeName,
    description: rawDescription.slice(0, MAX_DESCRIPTION_LENGTH),
    content: rawContent.slice(0, MAX_CONTENT_LENGTH),
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
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", "return=representation");

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

  const prompt = Array.isArray(data) ? data[0] ?? null : null;

  return {
    ok: true as const,
    data: prompt
      ? {
          ...prompt,
          tags: Array.isArray(prompt.tags) ? prompt.tags : [],
        }
      : null,
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
    data: Array.isArray(data)
      ? data.map((prompt) => ({
          ...prompt,
          tags: Array.isArray(prompt.tags) ? prompt.tags : [],
        }))
      : [],
  };
}

async function deletePrompt(input: {
  promptsTableUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  promptId: string;
}) {
  const query =
    `id=eq.${encodeURIComponent(input.promptId)}` +
    `&user_id=eq.${encodeURIComponent(input.userId)}`;

  const headers = new Headers();
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Accept", "application/json");

  const res = await fetch(`${input.promptsTableUrl}?${query}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();

    logSafeError("OpenLura prompt delete failed", new Error(errorText), {
      status: res.status,
      promptId: input.promptId,
    });

    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
  };
}

async function updatePrompt(input: {
  promptsTableUrl: string;
  supabaseServiceRoleKey: string;
  userId: string;
  promptId: string;
  updates: {
    name: string;
    description: string;
    content: string;
    tags: string[];
  };
}) {
  const query =
    "select=id,name,description,content,tags,last_used_at,created_at" +
    `&id=eq.${encodeURIComponent(input.promptId)}` +
    `&user_id=eq.${encodeURIComponent(input.userId)}`;

  const headers = new Headers();
  headers.set("apikey", input.supabaseServiceRoleKey);
  headers.set("Authorization", `Bearer ${input.supabaseServiceRoleKey}`);
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  headers.set("Prefer", "return=representation");

  const res = await fetch(`${input.promptsTableUrl}?${query}`, {
    method: "PATCH",
    headers,
    cache: "no-store",
    body: JSON.stringify({
      name: input.updates.name,
      description: input.updates.description,
      content: input.updates.content,
      tags: input.updates.tags,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();

    logSafeError("OpenLura prompt update failed", new Error(errorText), {
      status: res.status,
      promptId: input.promptId,
    });

    return {
      ok: false as const,
      data: null,
    };
  }

  const data = (await res.json()) as PromptRow[];
  const prompt = Array.isArray(data) ? data[0] ?? null : null;

  return {
    ok: true as const,
    data: prompt
      ? {
          ...prompt,
          tags: Array.isArray(prompt.tags) ? prompt.tags : [],
        }
      : null,
  };
}

export async function POST(req: Request) {
  try {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > MAX_REQUEST_BYTES) {
      return badRequestResponse("Request too large");
    }

    const userId = await getRequestUserId(req);

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
    const userId = await getRequestUserId(req);

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

export async function PUT(req: Request) {
  try {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > MAX_REQUEST_BYTES) {
      return badRequestResponse("Request too large");
    }

    const userId = await getRequestUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const parsed = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

    if (!parsed.ok) {
      return badRequestResponse(
        parsed.reason === "too_large" ? "Request too large" : "Invalid JSON"
      );
    }

    const normalized = normalizeUpdatePromptBody(parsed.body);

    if (!normalized) {
      return badRequestResponse("Invalid prompt update payload");
    }

    const { promptsTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const result = await updatePrompt({
      promptsTableUrl,
      supabaseServiceRoleKey,
      userId,
      promptId: normalized.id,
      updates: {
        name: normalized.name,
        description: normalized.description,
        content: normalized.content,
        tags: normalized.tags,
      },
    });

    if (!result.ok) {
      return internalErrorResponse("Failed to update prompt");
    }

    return NextResponse.json(
      {
        success: true,
        prompt: result.data,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logSafeError("OpenLura prompts PUT failed", error);
    return internalErrorResponse("Failed to update prompt");
  }
}

export async function DELETE(req: Request) {
  try {
    const contentLength = getContentLength(req);

    if (contentLength !== null && contentLength > MAX_REQUEST_BYTES) {
      return badRequestResponse("Request too large");
    }

    const userId = await getRequestUserId(req);

    if (!userId) {
      return unauthorizedResponse();
    }

    const parsed = await readJsonBodyWithinLimit(req, MAX_REQUEST_BYTES);

    if (!parsed.ok) {
      return badRequestResponse(
        parsed.reason === "too_large" ? "Request too large" : "Invalid JSON"
      );
    }

    const normalized = normalizeDeletePromptBody(parsed.body);

    if (!normalized) {
      return badRequestResponse("Invalid prompt delete payload");
    }

    const { promptsTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const result = await deletePrompt({
      promptsTableUrl,
      supabaseServiceRoleKey,
      userId,
      promptId: normalized.id,
    });

    if (!result.ok) {
      return internalErrorResponse("Failed to delete prompt");
    }

    return NextResponse.json(
      {
        success: true,
        deletedId: normalized.id,
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logSafeError("OpenLura prompts DELETE failed", error);
    return internalErrorResponse("Failed to delete prompt");
  }
}