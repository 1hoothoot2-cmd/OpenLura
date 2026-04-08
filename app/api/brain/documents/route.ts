export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "brain_documents";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ["application/pdf", "text/plain", "text/markdown"];
const ALLOWED_EXT = ["pdf", "txt", "md"];

function dbHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "return=representation",
  };
}

function storageHeaders(contentType?: string) {
  const h: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function resolveFileType(mimeType: string, filename: string): string {
  if (ALLOWED_MIME.includes(mimeType)) return mimeType;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "md") return "text/markdown";
  return "text/plain";
}

// ─── Verify notebook ownership ────────────────────────────────────────────────

async function verifyNotebookOwner(notebookId: string, userId: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ─── GET — list documents ─────────────────────────────────────────────────────

export async function GET(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get("notebookId")?.trim();

  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });

  // Verify ownership
  const owns = await verifyNotebookOwner(notebookId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = `${SUPABASE_URL}/rest/v1/brain_documents?notebook_id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&select=id,name,file_type,file_size,created_at`;
    const res = await fetch(url, { headers: dbHeaders() });
    if (!res.ok) throw new Error("db fetch failed");
    const documents = await res.json();
    return NextResponse.json({ documents });
  } catch (err) {
    console.error("[Brain] GET documents error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── POST — upload document ───────────────────────────────────────────────────

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const notebookId = (formData.get("notebookId") as string)?.trim();

  if (!file || !(file instanceof Blob)) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });

  // Verify notebook ownership — HARD check
  const owns = await verifyNotebookOwner(notebookId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const originalName = (file as any).name ?? "document";
  const safeFilename = sanitizeFilename(originalName);
  const fileType = resolveFileType(file.type, originalName);
  const ext = safeFilename.split(".").pop()?.toLowerCase();

  // Validate type
  if (!ALLOWED_MIME.includes(fileType) && !ALLOWED_EXT.includes(ext ?? "")) {
    return NextResponse.json({ error: "File type not supported" }, { status: 400 });
  }

  // Validate size
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 413 });
  }

  // Storage path: userId/notebookId/timestamp_filename
  const timestamp = Date.now();
  const storagePath = `${userId}/${notebookId}/${timestamp}_${safeFilename}`;

  try {
    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        ...storageHeaders(fileType),
        "x-upsert": "false",
        "cache-control": "3600",
      },
      body: fileBuffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      console.error("[Brain] Storage upload failed detail", {
        status: uploadRes.status,
        body: errText,
        path: storagePath,
        bucket: BUCKET,
      });
      return NextResponse.json({ error: "Storage upload failed", detail: errText }, { status: 500 });
    }

    // Parse content
    let parsedContent = "";
    try {
      const { parseDocument } = await import("@/lib/brain/parser");
      const result = await parseDocument(fileBuffer, fileType, originalName);
      parsedContent = result.text;
    } catch (err) {
      console.error("[Brain] Parse error (non-fatal)", err instanceof Error ? err.message : "unknown");
    }

    // Save metadata to DB
    const dbUrl = `${SUPABASE_URL}/rest/v1/brain_documents`;
    const dbRes = await fetch(dbUrl, {
      method: "POST",
      headers: dbHeaders(),
      body: JSON.stringify({
        notebook_id: notebookId,
        user_id: userId,          // HARD enforced
        name: originalName.slice(0, 200),
        file_type: fileType,
        file_size: file.size,
        storage_path: storagePath,
        content: parsedContent,
      }),
    });

    if (!dbRes.ok) {
      const errText = await dbRes.text().catch(() => "");
      console.error("[Brain] DB insert failed", { status: dbRes.status, errText });
      // Attempt storage cleanup
      await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "DELETE",
        headers: storageHeaders(),
      }).catch(() => null);
      return NextResponse.json({ error: "Failed to save document metadata" }, { status: 500 });
    }

    const [document] = await dbRes.json();

    // Increment document_count on notebook
    await fetch(`${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: dbHeaders(),
      body: JSON.stringify({ document_count: `document_count + 1` }),
    }).catch(() => null); // Non-critical

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[Brain] POST document error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ─── DELETE — delete document ─────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;
  const { searchParams } = new URL(req.url);
  const docId = searchParams.get("id")?.trim();
  const notebookId = searchParams.get("notebookId")?.trim();

  if (!docId || !notebookId) return NextResponse.json({ error: "Missing id or notebookId" }, { status: 400 });

  // Fetch doc — verify user_id ownership HARD
  let storagePath: string;
  try {
    const checkUrl = `${SUPABASE_URL}/rest/v1/brain_documents?id=eq.${encodeURIComponent(docId)}&user_id=eq.${encodeURIComponent(userId)}&notebook_id=eq.${encodeURIComponent(notebookId)}&select=id,storage_path`;
    const checkRes = await fetch(checkUrl, { headers: dbHeaders() });
    if (!checkRes.ok) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    const rows = await checkRes.json();
    if (!rows || rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    storagePath = rows[0].storage_path;
  } catch (err) {
    console.error("[Brain] DELETE ownership check error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }

  try {
    // Delete from DB
    const dbUrl = `${SUPABASE_URL}/rest/v1/brain_documents?id=eq.${encodeURIComponent(docId)}&user_id=eq.${encodeURIComponent(userId)}`;
    const dbRes = await fetch(dbUrl, { method: "DELETE", headers: dbHeaders() });
    if (!dbRes.ok) {
      console.error("[Brain] DELETE db failed", dbRes.status);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    // Delete from Storage
    await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
      method: "DELETE",
      headers: storageHeaders(),
    }).catch(() => null); // Non-critical if storage cleanup fails

    // Decrement document_count
    await fetch(`${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: dbHeaders(),
      body: JSON.stringify({ document_count: `document_count - 1` }),
    }).catch(() => null);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[Brain] DELETE document error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}