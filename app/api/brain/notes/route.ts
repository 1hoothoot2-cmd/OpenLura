import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { parsePlainText } from "@/lib/brain/parser";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const MAX_BODY = 20_000;
const MAX_TITLE = 100;

function dbHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "return=representation",
  };
}

async function verifyNotebookOwner(notebookId: string, userId: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const notebookId = typeof body?.notebookId === "string" ? body.notebookId.trim() : "";
  const noteBody   = typeof body?.body === "string" ? body.body.trim().slice(0, MAX_BODY) : "";
  const noteTitle  = typeof body?.title === "string" ? body.title.trim().slice(0, MAX_TITLE) : "";

  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });
  if (!noteBody)   return NextResponse.json({ error: "Note body is required" }, { status: 400 });

  // Verify ownership — HARD
  const owns = await verifyNotebookOwner(notebookId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { text: cleanedBody } = parsePlainText(noteBody);
  const name = noteTitle || `Note — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  try {
    const dbUrl = `${SUPABASE_URL}/rest/v1/brain_documents`;
    const dbRes = await fetch(dbUrl, {
      method: "POST",
      headers: dbHeaders(),
      body: JSON.stringify({
        notebook_id: notebookId,
        user_id: userId,          // HARD enforced
        name,
        file_type: "text/note",
        file_size: new TextEncoder().encode(noteBody).length,
        storage_path: "",
        source_url: null,
        content: cleanedBody,
      }),
    });

    if (!dbRes.ok) {
      const err = await dbRes.text().catch(() => "");
      console.error("[Brain] Note DB insert failed", { status: dbRes.status, err });
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }

    const [document] = await dbRes.json();

    // Increment document_count via RPC
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_notebook_document_count`, {
      method: "POST",
      headers: dbHeaders(),
      body: JSON.stringify({ notebook_id: notebookId, user_id: userId, delta: 1 }),
    }).catch(() => null);

    // Chunk + embed async (non-blocking)
    if (cleanedBody) {
      import("@/lib/brain/chunker").then(({ persistChunks }) =>
        persistChunks({
          documentId: document.id,
          notebookId,
          userId,
          content: cleanedBody,
          supabaseUrl: SUPABASE_URL,
          serviceKey: SUPABASE_SERVICE_KEY,
        }).then(() =>
          import("@/lib/brain/embedder").then(({ embedDocumentChunks }) =>
            embedDocumentChunks({
              documentId: document.id,
              userId,
              supabaseUrl: SUPABASE_URL,
              serviceKey: SUPABASE_SERVICE_KEY,
              openAiKey: process.env.OPENAI_API_KEY!,
            })
          )
        )
      ).catch(e => console.error("[Brain] Chunk/embed failed", e instanceof Error ? e.message : "unknown"));
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (err) {
    console.error("[Brain] Note POST error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}