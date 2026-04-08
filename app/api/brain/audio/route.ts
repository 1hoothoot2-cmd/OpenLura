import { NextRequest, NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notebookId, notebookName } = await req.json();
  if (!notebookId) return NextResponse.json({ error: "Missing notebookId" }, { status: 400 });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fetch chunks
  const chunkRes = await fetch(
    `${supabaseUrl}/rest/v1/brain_chunks?notebook_id=eq.${notebookId}&order=chunk_index.asc&limit=10&select=content`,
    { headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` } }
  );
  const chunks = chunkRes.ok ? await chunkRes.json() : [];
  const content = chunks.map((c: any) => c.content).join("\n\n").slice(0, 3000);

  // Generate spoken summary via Claude
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Detect the language of the content below and write a spoken summary of this notebook called "${notebookName}" IN THAT SAME LANGUAGE.
Write it as if you are explaining it out loud in 3-4 sentences.
Natural, conversational tone. No bullet points, no markdown.
IMPORTANT: respond only in the language of the content, not in English.

Content:
${content}`,
      }],
    }),
  });

  const claudeData = await claudeRes.json();
  const spokenText = claudeData.content?.[0]?.text || `This notebook is called ${notebookName}.`;

  // Convert to speech via OpenAI TTS
  const ttsRes = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: spokenText,
      voice: "nova",
    }),
  });

  if (!ttsRes.ok) {
    return NextResponse.json({ error: "TTS failed" }, { status: 500 });
  }

  const audioBuffer = await ttsRes.arrayBuffer();
  return new NextResponse(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.byteLength.toString(),
    },
  });
}