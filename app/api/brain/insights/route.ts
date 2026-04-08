import { NextRequest, NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docName, content } = await req.json();
  if (!docName) return NextResponse.json({ error: "Missing docName" }, { status: 400 });

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
        content: `Give exactly 3 short key insights from this document called "${docName}". Return ONLY a JSON array of 3 strings, no markdown, no other text. Example: ["insight 1","insight 2","insight 3"]\n\nContent:\n${(content || docName).slice(0, 2000)}`,
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