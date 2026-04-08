// ─── Config ───────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;
const BATCH_SIZE = 20; // max chunks per OpenAI request
const MAX_CHARS_PER_CHUNK = 6000; // ~1500 tokens — well within model limit

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmbedResult {
  count: number;
  error?: string;
}

// ─── OpenAI embedding request ─────────────────────────────────────────────────

async function fetchEmbeddings(texts: string[], apiKey: string): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.slice(0, MAX_CHARS_PER_CHUNK)),
      dimensions: EMBEDDING_DIMS,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (data.data as { embedding: number[] }[]).map(d => d.embedding);
}

// ─── Persist embeddings to Supabase ──────────────────────────────────────────

async function updateChunkEmbedding(
  chunkId: string,
  embedding: number[],
  supabaseUrl: string,
  serviceKey: string
): Promise<void> {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/brain_chunks?id=eq.${encodeURIComponent(chunkId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ embedding: `[${embedding.join(",")}]` }),
    }
  );

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[Brain] Embedding update failed", { chunkId, status: res.status, err });
  }
}

// ─── Main: embed all chunks for a document ────────────────────────────────────

export async function embedDocumentChunks({
  documentId,
  userId,
  supabaseUrl,
  serviceKey,
  openAiKey,
}: {
  documentId: string;
  userId: string;
  supabaseUrl: string;
  serviceKey: string;
  openAiKey: string;
}): Promise<EmbedResult> {
  // Fetch chunks for this document
  const chunksRes = await fetch(
    `${supabaseUrl}/rest/v1/brain_chunks?document_id=eq.${encodeURIComponent(documentId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,content&order=chunk_index.asc`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!chunksRes.ok) {
    return { count: 0, error: "Failed to fetch chunks" };
  }

  const chunks: { id: string; content: string }[] = await chunksRes.json();

  if (!chunks || chunks.length === 0) {
    return { count: 0 };
  }

  let embedded = 0;

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(c => c.content);

    try {
      const embeddings = await fetchEmbeddings(texts, openAiKey);

      // Update each chunk with its embedding
      await Promise.all(
        batch.map((chunk, idx) =>
          updateChunkEmbedding(chunk.id, embeddings[idx], supabaseUrl, serviceKey)
        )
      );

      embedded += batch.length;
    } catch (err) {
      console.error("[Brain] Embedding batch failed", {
        batchStart: i,
        error: err instanceof Error ? err.message : "unknown",
      });
      // Continue with next batch — partial success is ok
    }
  }

  return { count: embedded };
}