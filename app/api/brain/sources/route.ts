import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { parsePlainText } from "@/lib/brain/parser";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const MAX_CONTENT_LENGTH = 200_000; // ~200KB text
const FETCH_TIMEOUT_MS = 12_000;

function dbHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "return=representation",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/)/.test(url);
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

function extractTitle(html: string, fallbackUrl: string): string {
  const match = html.match(/<title[^>]*>([^<]{1,120})<\/title>/i);
  if (match) return match[1].trim();
  try { return new URL(fallbackUrl).hostname; } catch { return fallbackUrl.slice(0, 80); }
}

// ─── Fetch webpage ────────────────────────────────────────────────────────────

async function fetchWebpage(url: string): Promise<{ title: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OpenLura-Brain/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("Unsupported content type");
    }

    const html = await res.text();
    const title = extractTitle(html, url);
    let content = stripHtml(html);

    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH);
    }

    if (content.length < 100) throw new Error("Page content too short");

    return { title, content };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Fetch YouTube transcript (via timedtext API) ─────────────────────────────

async function fetchYouTubeTranscript(videoId: string, url: string): Promise<{ title: string; content: string }> {
  // Fetch video page to get title
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OpenLura-Brain/1.0)" },
    });

    const html = pageRes.ok ? await pageRes.text() : "";
    const title = extractTitle(html, url);

    // Try to fetch captions via timedtext
    const captionRes = await fetch(
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; OpenLura-Brain/1.0)" } }
    ).catch(() => null);

    let transcript = "";

    if (captionRes?.ok) {
      try {
        const data = await captionRes.json();
        const events: any[] = data?.events ?? [];
        transcript = events
          .filter((e: any) => e.segs)
          .flatMap((e: any) => e.segs.map((s: any) => s.utf8 ?? ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
      } catch { transcript = ""; }
    }

    if (!transcript) {
      // Fallback: extract description from page HTML
      const descMatch = html.match(/"shortDescription":"([\s\S]{0,2000})"/);
      transcript = descMatch
        ? descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
        : `YouTube video: ${title}\nURL: ${url}\n\nTranscript not available for this video.`;
    }

    return {
      title: `[YouTube] ${title}`,
      content: transcript.slice(0, MAX_CONTENT_LENGTH),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Verify notebook ownership ────────────────────────────────────────────────

async function verifyNotebookOwner(notebookId: string, userId: string): Promise<boolean> {
  const url = `${SUPABASE_URL}/rest/v1/brain_notebooks?id=eq.${encodeURIComponent(notebookId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`;
  const res = await fetch(url, { headers: dbHeaders() });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = identity.identity.userId;

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const notebookId = typeof body?.notebookId === "string" ? body.notebookId.trim() : "";

  if (!url || !isValidUrl(url)) return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });

  // Verify ownership
  const owns = await verifyNotebookOwner(notebookId, userId);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch content
  let title: string;
  let content: string;

  try {
    if (isYouTubeUrl(url)) {
      const videoId = extractYouTubeId(url);
      if (!videoId) return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
      const result = await fetchYouTubeTranscript(videoId, url);
      title = result.title;
      content = result.content;
    } else {
      const result = await fetchWebpage(url);
      title = result.title;
      content = result.content;
    }
  } catch (err) {
    console.error("[Brain] Source fetch error", err instanceof Error ? err.message : "unknown", { url });
    return NextResponse.json({ error: "Could not fetch URL" }, { status: 422 });
  }

  // Clean content
  const { text: cleanedContent } = parsePlainText(content);

  // Save to brain_documents (no storage — content in DB)
  try {
    const dbUrl = `${SUPABASE_URL}/rest/v1/brain_documents`;
    const dbRes = await fetch(dbUrl, {
      method: "POST",
      headers: dbHeaders(),
      body: JSON.stringify({
        notebook_id: notebookId,
        user_id: userId,          // HARD enforced
        name: title.slice(0, 200),
        file_type: "text/plain",
        file_size: new TextEncoder().encode(cleanedContent).length,
        storage_path: "",         // no file — content stored in DB
        source_url: url,
        content: cleanedContent,
      }),
    });

    if (!dbRes.ok) {
      const err = await dbRes.text().catch(() => "");
      console.error("[Brain] Source DB insert failed", { status: dbRes.status, err });
      return NextResponse.json({ error: "Failed to save source" }, { status: 500 });
    }

    const [document] = await dbRes.json();

    // Increment document_count via RPC
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_notebook_document_count`, {
      method: "POST",
      headers: dbHeaders(),
      body: JSON.stringify({ notebook_id: notebookId, user_id: userId, delta: 1 }),
    }).catch(() => null);

    // Chunk + embed async (non-blocking)
    if (cleanedContent) {
      import("@/lib/brain/chunker").then(({ persistChunks }) =>
        persistChunks({
          documentId: document.id,
          notebookId,
          userId,
          content: cleanedContent,
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
    console.error("[Brain] Source POST error", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}