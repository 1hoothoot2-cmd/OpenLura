import { NextRequest, NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docName, content, docId, notebookId } = await req.json();
  if (!docName) return NextResponse.json({ error: "Missing docName" }, { status: 400 });

  // Fetch content from Supabase if not provided
  let resolvedContent = content || "";
  if (!resolvedContent && docId) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const chunkRes = await fetch(
        `${supabaseUrl}/rest/v1/brain_chunks?document_id=eq.${docId}&order=chunk_index.asc&limit=5&select=content`,
        {
          headers: {
            apikey: serviceKey!,
            Authorization: `Bearer ${serviceKey!}`,
          },
        }
      );
      if (chunkRes.ok) {
        const chunks = await chunkRes.json();
        resolvedContent = chunks.map((c: any) => c.content).join("\n\n");
      }
    } catch {}
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Give exactly 3 short key insights from this document called "${docName}". Return ONLY a JSON array of 3 strings, no markdown, no other text. Example: ["insight 1","insight 2","insight 3"]\n\nContent:\n${(resolvedContent || docName).slice(0, 2000)}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json({ insights: Array.isArray(parsed) ? parsed : [] });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}