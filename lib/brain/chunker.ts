// ─── Config ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 500;      // target tokens per chunk
const CHUNK_OVERLAP = 50;    // overlap tokens between chunks
const CHARS_PER_TOKEN = 4;   // rough estimate

const CHUNK_CHARS = CHUNK_SIZE * CHARS_PER_TOKEN;         // ~2000 chars
const OVERLAP_CHARS = CHUNK_OVERLAP * CHARS_PER_TOKEN;    // ~200 chars

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Chunk {
  content: string;
  chunk_index: number;
  char_count: number;
}

// ─── Main chunker ─────────────────────────────────────────────────────────────

export function chunkText(text: string): Chunk[] {
  if (!text || text.trim().length === 0) return [];

  const normalized = text.replace(/\r\n/g, "\n").trim();

  // Split into paragraphs first for natural boundaries
  const paragraphs = normalized.split(/\n{2,}/);

  const chunks: Chunk[] = [];
  let current = "";
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const para = paragraph.trim();
    if (!para) continue;

    // If adding this paragraph would exceed chunk size
    if (current.length + para.length + 2 > CHUNK_CHARS && current.length > 0) {
      // Save current chunk
      chunks.push({
        content: current.trim(),
        chunk_index: chunkIndex++,
        char_count: current.trim().length,
      });

      // Start new chunk with overlap from end of current
      const overlapText = getOverlap(current);
      current = overlapText + (overlapText ? "\n\n" : "") + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }

    // If current is already way too long (e.g. single huge paragraph), force split
    while (current.length > CHUNK_CHARS * 1.5) {
      const splitAt = findSplitPoint(current, CHUNK_CHARS);
      chunks.push({
        content: current.slice(0, splitAt).trim(),
        chunk_index: chunkIndex++,
        char_count: splitAt,
      });
      const overlapText = getOverlap(current.slice(0, splitAt));
      current = overlapText + (overlapText ? " " : "") + current.slice(splitAt).trim();
    }
  }

  // Save remaining content
  if (current.trim().length > 0) {
    chunks.push({
      content: current.trim(),
      chunk_index: chunkIndex++,
      char_count: current.trim().length,
    });
  }

  return chunks;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOverlap(text: string): string {
  if (text.length <= OVERLAP_CHARS) return text;
  const overlap = text.slice(-OVERLAP_CHARS);
  // Try to start at a word boundary
  const spaceIdx = overlap.indexOf(" ");
  return spaceIdx > 0 ? overlap.slice(spaceIdx + 1) : overlap;
}

function findSplitPoint(text: string, target: number): number {
  // Try to split at sentence boundary near target
  const slice = text.slice(0, target + 200);
  const sentenceEnd = slice.lastIndexOf(". ", target);
  if (sentenceEnd > target * 0.7) return sentenceEnd + 2;

  // Fall back to word boundary
  const wordEnd = slice.lastIndexOf(" ", target);
  if (wordEnd > target * 0.7) return wordEnd + 1;

  return target;
}

// ─── Supabase persist ─────────────────────────────────────────────────────────

export async function persistChunks({
  documentId,
  notebookId,
  userId,
  content,
  supabaseUrl,
  serviceKey,
}: {
  documentId: string;
  notebookId: string;
  userId: string;
  content: string;
  supabaseUrl: string;
  serviceKey: string;
}): Promise<{ count: number; error?: string }> {
  const chunks = chunkText(content);

  if (chunks.length === 0) {
    return { count: 0 };
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    Prefer: "return=minimal",
  };

  // Delete existing chunks for this document (re-chunking case)
  await fetch(
    `${supabaseUrl}/rest/v1/brain_chunks?document_id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method: "DELETE", headers }
  ).catch(() => null);

  // Insert all chunks in one request
  const rows = chunks.map(chunk => ({
    document_id: documentId,
    notebook_id: notebookId,
    user_id: userId,
    content: chunk.content,
    chunk_index: chunk.chunk_index,
  }));

  const res = await fetch(`${supabaseUrl}/rest/v1/brain_chunks`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[Brain] Chunk persist failed", { status: res.status, err });
    return { count: 0, error: "Chunk persist failed" };
  }

  return { count: chunks.length };
}