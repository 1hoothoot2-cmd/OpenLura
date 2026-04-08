import { NextRequest, NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const identity = await requireOpenLuraIdentity(req);
  if (!identity.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { docName, content, docId, notebookId, quickAction, prompt, learningTool } = await req.json();
  if (!docName) return NextResponse.json({ error: "Missing docName" }, { status: 400 });

  // Check tier — AI features only for pro
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const tierRes = await fetch(
    `${supabaseUrl}/rest/v1/user_usage?user_id=eq.${identity.identity.userId}&select=tier`,
    { headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` } }
  );
  const tierRows = tierRes.ok ? await tierRes.json() : [];
  const userTier = tierRows?.[0]?.tier || "free";

  if (userTier === "free") {
    return NextResponse.json({ error: "AI features require a Go plan. Upgrade to use insights, quiz and flashcards." }, { status: 403 });
  }

  // Quick action — fetch all notebook chunks and run custom prompt
  if (quickAction && prompt && notebookId) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Verify notebook ownership
      const ownerCheck = await fetch(
        `${supabaseUrl}/rest/v1/brain_notebooks?id=eq.${notebookId}&user_id=eq.${identity.identity.userId}&select=id`,
        { headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` } }
      );
      const ownerRows = ownerCheck.ok ? await ownerCheck.json() : [];
      if (!Array.isArray(ownerRows) || ownerRows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const chunkRes = await fetch(
        `${supabaseUrl}/rest/v1/brain_chunks?notebook_id=eq.${notebookId}&order=chunk_index.asc&limit=20&select=content`,
        {
          headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` },
        }
      );
      const chunks = chunkRes.ok ? await chunkRes.json() : [];
      const allContent = chunks.map((c: any) => c.content).join("\n\n").slice(0, 4000);

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{ role: "user", content: `${prompt}\n\nContent:\n${allContent}` }],
        }),
      });
      const aiData = await aiRes.json();
      const text = aiData.content?.[0]?.text || "";
      return NextResponse.json({ text });
    } catch {
      return NextResponse.json({ text: "" });
    }
  }

  // Learning tools — quiz or flashcards
  if (learningTool && notebookId) {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      // Verify notebook ownership
      const ownerCheck = await fetch(
        `${supabaseUrl}/rest/v1/brain_notebooks?id=eq.${notebookId}&user_id=eq.${identity.identity.userId}&select=id`,
        { headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` } }
      );
      const ownerRows = ownerCheck.ok ? await ownerCheck.json() : [];
      if (!Array.isArray(ownerRows) || ownerRows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const chunkRes = await fetch(
        `${supabaseUrl}/rest/v1/brain_chunks?notebook_id=eq.${notebookId}&order=chunk_index.asc&limit=20&select=content`,
        { headers: { apikey: serviceKey!, Authorization: `Bearer ${serviceKey!}` } }
      );
      const chunks = chunkRes.ok ? await chunkRes.json() : [];
      const allContent = chunks.map((c: any) => c.content).join("\n\n").slice(0, 4000);

      const learningPrompt = learningTool === "quiz"
        ? `Create a quiz with exactly 4 multiple choice questions based on this content. Return ONLY a JSON array, no markdown. Format: [{"question":"...","options":["A)...","B)...","C)...","D)..."],"answer":"A"}]`
        : `Create exactly 5 flashcards based on this content. Return ONLY a JSON array, no markdown. Format: [{"front":"...","back":"..."}]`;

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1000,
          messages: [{ role: "user", content: `${learningPrompt}\n\nContent:\n${allContent}` }],
        }),
      });
      const aiData = await aiRes.json();
      const raw = aiData.content?.[0]?.text || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return NextResponse.json({ data: Array.isArray(parsed) ? parsed : [] });
    } catch {
      return NextResponse.json({ data: [] });
    }
  }

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
console.log("[Brain Insights] API key present:", !!process.env.ANTHROPIC_API_KEY, "length:", process.env.ANTHROPIC_API_KEY?.length);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
        content: `Give exactly 3 short key insights from this document called "${docName}". Return ONLY a JSON array of 3 strings, no markdown, no other text. Example: ["insight 1","insight 2","insight 3"]\n\nContent:\n${(resolvedContent || docName).slice(0, 2000)}`,
      }],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  console.log("[Brain Insights] raw text:", text);
  console.log("[Brain Insights] resolvedContent length:", resolvedContent.length);
  console.log("[Brain Insights] Claude status:", res.status, data.type, data.error);

  if (!text) {
    console.error("[Brain Insights] No text in response:", JSON.stringify(data).slice(0, 300));
    return NextResponse.json({ insights: [] });
  }

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json({ insights: Array.isArray(parsed) ? parsed : [] });
  } catch (e) {
    console.error("[Brain Insights] JSON parse failed:", text);
    return NextResponse.json({ insights: [] });
  }
}