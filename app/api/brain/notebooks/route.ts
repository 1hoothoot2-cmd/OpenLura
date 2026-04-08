import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

// ─── Supabase config ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function supabaseHeaders(accessToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "return=representation",
  };
  return headers;
}

// ─── Validate notebook name ───────────────────────────────────────────────────

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().slice(0, 60);
  return name.length >= 1 ? name : null;
}

function sanitizeDesc(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 200);
}

function sanitizeEmoji(raw: unknown): string {
  if (typeof raw !== "string") return "🧠";
  const trimmed = raw.trim().slice(0, 8);
  return trimmed || "🧠";
}

// ─── GET — list notebooks for user ───────────────────────────────────────────

export async function GET(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = identity.identity.userId;

  // Single notebook by id
  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id")?.trim();

  if (singleId) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(singleId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,name,emoji,description,created_at,document_count`;
      const res = await fetch(url, { headers: supabaseHeaders() });
      if (!res.ok) return NextResponse.json({ error: "Failed" }, { status: 500 });
      const rows = await res.json();
      if (!rows || rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ notebook: rows[0] });
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=id,name,emoji,description,created_at,document_count`;
    const res = await fetch(url, { headers: supabaseHeaders() });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[Brain] GET notebooks failed", { status: res.status, err });
      return NextResponse.json({ error: "Failed to load notebooks" }, { status: 500 });
    }

    const notebooks = await res.json();
    return NextResponse.json({ notebooks });
  } catch (err) {
    console.error("[Brain] GET notebooks error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── POST — create notebook ───────────────────────────────────────────────────

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = identity.identity.userId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = sanitizeName((body as any)?.name);
  if (!name) {
    return NextResponse.json({ error: "Name is required (max 60 chars)" }, { status: 400 });
  }

  const description = sanitizeDesc((body as any)?.description);
  const emoji = sanitizeEmoji((body as any)?.emoji);

  try {
    const url = `${SUPABASE_URL}/rest/v1/brain_notebooks`;
    const res = await fetch(url, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({
        user_id: userId,        // HARD enforced — never from body
        name,
        description,
        emoji,
        document_count: 0,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[Brain] POST notebook failed", { status: res.status, err });
      return NextResponse.json({ error: "Failed to create notebook" }, { status: 500 });
    }

    const [notebook] = await res.json();
    return NextResponse.json({ notebook }, { status: 201 });
  } catch (err) {
    console.error("[Brain] POST notebook error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── DELETE — delete notebook (user_id enforced) ──────────────────────────────

export async function DELETE(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = identity.identity.userId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return NextResponse.json({ error: "Missing notebook id" }, { status: 400 });
  }

  // Validate ownership before delete — HARD security check
  try {
    const checkUrl = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}&select=id`;
    const checkRes = await fetch(checkUrl, { headers: supabaseHeaders() });

    if (!checkRes.ok) {
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    const rows = await checkRes.json();
    if (!rows || rows.length === 0) {
      // Either doesn't exist or belongs to another user — same response
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } catch (err) {
    console.error("[Brain] DELETE ownership check error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: supabaseHeaders(),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[Brain] DELETE notebook failed", { status: res.status, err });
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[Brain] DELETE notebook error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}