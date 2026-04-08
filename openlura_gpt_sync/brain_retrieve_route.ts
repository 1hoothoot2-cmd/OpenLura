export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { retrieveChunks, formatChunksAsContext } from "@/lib/brain/retriever";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function dbHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
}

// ─── Verify notebook ownership ────────────────────────────────────────────────

async function verifyNotebookOwner(notebookId: string, userId: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ─── Get document names for source referencing ────────────────────────────────

async function getDocumentNames(
  documentIds: string[],
  userId: string
): Promise<Record<string, string>> {
  if (!documentIds.length) return {};

  const ids = documentIds.map(id => `"${id}"`).join(",");
  const url = `${SUPABASE_URL}/rest/v1/brain_documents?id=in.(${ids})&user_id=eq.${encodeURIComponent(userId)}&select=id,name`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) return {};

  const rows: { id: string; name: string }[] = await res.json();
  return Object.fromEntries(rows.map(r => [r.id, r.name]));
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const query      = typeof body?.query === "string" ? body.query.trim() : "";
  const notebookId = typeof body?.notebookId === "string" ? body.notebookId.trim() : "";
  const topK       = typeof body?.topK === "number" ? Math.min(Math.max(1, body.topK), 10) : 5;

  if (!query)      return NextResponse.json({ error: "Missing query" }, { status: 400 });
  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });

  // Verify ownership — HARD
  const owns = await verifyNotebookOwner(notebookId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Retrieve
  const result = await retrieveChunks({
    query,
    notebookId,
    userId,
    topK,
    supabaseUrl: SUPABASE_URL,
    serviceKey: SUPABASE_SERVICE_KEY,
    openAiKey: process.env.OPENAI_API_KEY!,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // Get document names for source referencing
  const docIds = [...new Set(result.chunks.map(c => c.document_id))];
  const docNames = await getDocumentNames(docIds, userId);

  // Format as context string
  const context = formatChunksAsContext(result.chunks, docNames);

  return NextResponse.json({
    chunks: result.chunks,
    context,
    docNames,
    count: result.chunks.length,
  });
}