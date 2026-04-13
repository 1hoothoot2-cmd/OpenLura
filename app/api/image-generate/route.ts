import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FAL_KEY = process.env.FAL_KEY;
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const personalStateTable = process.env.OPENLURA_PERSONAL_STATE_TABLE || "openlura_personal_state";
const NO_STORE = { "Cache-Control": "no-store" };

const MODELS = ["dalle3", "nano-banana", "nano-banana-2", "nano-banana-pro"] as const;
type Model = typeof MODELS[number];

const MODEL_POINTS: Record<Model, number> = {
  "dalle3": 2,
  "nano-banana": 2,
  "nano-banana-2": 5,
  "nano-banana-pro": 10,
};

const FAL_MODEL_IDS: Record<string, string> = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
};

const MONTHLY_POINTS = 100;

function getCurrentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

async function generateWithFal(modelId: string, prompt: string, imageUrl?: string): Promise<string> {
  if (!FAL_KEY) throw new Error("FAL_KEY not configured");
  const body: any = { prompt, num_images: 1, aspect_ratio: "1:1" };
  if (imageUrl) body.image_urls = [imageUrl];
  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`fal.ai error ${res.status}`);
  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("No image URL in fal.ai response");
  return url;
}

async function generateWithDallE(prompt: string): Promise<string> {
  const result = await openai.images.generate({
    model: "dall-e-3", prompt, n: 1, size: "1024x1024", response_format: "url",
  });
  const url = result.data?.[0]?.url;
  if (!url) throw new Error("No image URL from DALL-E");
  return url;
}

export async function GET(req: Request) {
  try {
    const identity = await resolveOpenLuraRequestIdentity(req);
    if (!identity.isAuthenticated || !identity.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data } = await supabase
      .from(personalStateTable)
      .select("usage_stats")
      .eq("user_id", identity.userId)
      .single();

    const stats = (data?.usage_stats as any) || {};
    const tier = stats.tier || "free";
    const monthStr = getCurrentMonthStr();
    const resetMonth = stats.photo_points_reset;
    const points = resetMonth !== monthStr ? MONTHLY_POINTS : (stats.photo_points ?? MONTHLY_POINTS);
    const history = Array.isArray(stats.photo_history) ? stats.photo_history.slice(0, 50) : [];

    return NextResponse.json({ points, history, tier }, { headers: NO_STORE });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  try {
    const identity = await resolveOpenLuraRequestIdentity(req);
    if (!identity.isAuthenticated || !identity.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
    const model: Model = MODELS.includes(body?.model) ? body.model : "nano-banana-2";
    const editImageUrl = typeof body?.editImageUrl === "string" ? body.editImageUrl.trim() : null;
    const isEdit = !!editImageUrl;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400, headers: NO_STORE });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data } = await supabase
      .from(personalStateTable)
      .select("usage_stats")
      .eq("user_id", identity.userId)
      .single();

    const stats = (data?.usage_stats as any) || {};
    const tier = stats.tier || "free";

    // Tier check
    if (tier === "free") {
      return NextResponse.json({ error: "Upgrade required", code: "upgrade_required" }, { status: 403, headers: NO_STORE });
    }

    // Punten check + maand reset
    const monthStr = getCurrentMonthStr();
    const resetMonth = stats.photo_points_reset;
    let currentPoints = resetMonth !== monthStr ? MONTHLY_POINTS : (stats.photo_points ?? MONTHLY_POINTS);
    const cost = MODEL_POINTS[model];

    if (currentPoints < cost) {
      return NextResponse.json({ error: "Not enough points", code: "no_points", points: currentPoints }, { status: 402, headers: NO_STORE });
    }

    // Genereer
    let url: string;
    if (model === "dalle3") {
      url = await generateWithDallE(prompt);
    } else {
      const falModel = isEdit ? `${FAL_MODEL_IDS[model]}/edit` : FAL_MODEL_IDS[model];
      url = await generateWithFal(falModel, prompt, editImageUrl ?? undefined);
    }

    // Sla op + trek punten af
    const newPoints = currentPoints - cost;
    const historyEntry = { id: crypto.randomUUID(), url, prompt, model, points: cost, created_at: new Date().toISOString(), ...(isEdit ? { editedFrom: editImageUrl } : {}) };
    const existingHistory = Array.isArray(stats.photo_history) ? stats.photo_history : [];
    const newHistory = [historyEntry, ...existingHistory].slice(0, 50);

    await supabase.from(personalStateTable).upsert({
      user_id: identity.userId,
      usage_stats: {
        ...stats,
        photo_points: newPoints,
        photo_points_reset: monthStr,
        photo_history: newHistory,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({ url, model, points: newPoints, cost }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Image generate failed", typeof err?.message === "string" ? err.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "Generation failed" }, { status: 500, headers: NO_STORE });
  }
}

export async function DELETE(req: Request) {
  try {
    const identity = await resolveOpenLuraRequestIdentity(req);
    if (!identity.isAuthenticated || !identity.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400, headers: NO_STORE });

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data } = await supabase
      .from(personalStateTable)
      .select("usage_stats")
      .eq("user_id", identity.userId)
      .single();

    const stats = (data?.usage_stats as any) || {};
    const history = Array.isArray(stats.photo_history) ? stats.photo_history : [];
    const newHistory = history.filter((item: any) => item.id !== id);

    await supabase.from(personalStateTable).upsert({
      user_id: identity.userId,
      usage_stats: { ...stats, photo_history: newHistory },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return NextResponse.json({ success: true }, { headers: NO_STORE });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: NO_STORE });
  }
}