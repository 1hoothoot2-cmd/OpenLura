// ─── Config ───────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const DEFAULT_TOP_K = 5;
const MIN_SIMILARITY = 0.3; // filter out irrelevant chunks

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  chunk_index: number;
  similarity: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  query_embedding?: number[];
  error?: string;
}

// ─── Embed query ──────────────────────────────────────────────────────────────

async function embedQuery(query: string, apiKey: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: query.slice(0, 8000),
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embedding failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding as number[];
}

// ─── Main retrieval function ──────────────────────────────────────────────────

export async function retrieveChunks({
  query,
  notebookId,
  userId,
  topK = DEFAULT_TOP_K,
  minSimilarity = MIN_SIMILARITY,
  supabaseUrl,
  serviceKey,
  openAiKey,
}: {
  query: string;
  notebookId: string;
  userId: string;
  topK?: number;
  minSimilarity?: number;
  supabaseUrl: string;
  serviceKey: string;
  openAiKey: string;
}): Promise<RetrievalResult> {
  if (!query?.trim()) return { chunks: [] };

  // Embed the query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedQuery(query.trim(), openAiKey);
  } catch (err) {
    console.error("[Brain] Query embedding failed", err instanceof Error ? err.message : "unknown");
    return { chunks: [], error: "Embedding failed" };
  }

  // Call Supabase RPC
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/match_brain_chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_notebook_id: notebookId,
        match_user_id: userId,
        match_count: topK,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      console.error("[Brain] RPC match failed", { status: res.status, err });
      return { chunks: [], error: "Retrieval failed" };
    }

    const rows: RetrievedChunk[] = await res.json();

    // Filter by minimum similarity
    const filtered = (rows ?? []).filter(r => r.similarity >= minSimilarity);

    return {
      chunks: filtered,
      query_embedding: queryEmbedding,
    };
  } catch (err) {
    console.error("[Brain] Retrieval error", err instanceof Error ? err.message : "unknown");
    return { chunks: [], error: "Internal retrieval error" };
  }
}

// ─── Format chunks as context string for AI ───────────────────────────────────

export function formatChunksAsContext(chunks: RetrievedChunk[], docNames: Record<string, string>): string {
  if (!chunks.length) return "";

  return chunks
    .map((chunk, i) => {
      const docName = docNames[chunk.document_id] ?? "Unknown source";
      return `[Source ${i + 1}: ${docName}]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}