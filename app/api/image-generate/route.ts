import { NextResponse } from "next/server";
import OpenAI from "openai";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FAL_KEY = process.env.FAL_KEY;
const NO_STORE = { "Cache-Control": "no-store" };

const MODELS = ["dalle3", "nano-banana", "nano-banana-2", "nano-banana-pro"] as const;
type Model = typeof MODELS[number];

const FAL_MODEL_IDS: Record<string, string> = {
  "nano-banana": "fal-ai/nano-banana",
  "nano-banana-2": "fal-ai/nano-banana-2",
  "nano-banana-pro": "fal-ai/nano-banana-pro",
};

async function generateWithFal(modelId: string, prompt: string): Promise<string> {
  if (!FAL_KEY) throw new Error("FAL_KEY not configured");

  const res = await fetch(`https://fal.run/${modelId}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, num_images: 1, aspect_ratio: "1:1" }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`fal.ai error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const url = data?.images?.[0]?.url;
  if (!url) throw new Error("No image URL in fal.ai response");
  return url;
}

async function generateWithDallE(prompt: string): Promise<string> {
  const result = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "url",
  });
  const url = result.data?.[0]?.url;
  if (!url) throw new Error("No image URL from DALL-E");
  return url;
}

export async function POST(req: Request) {
  try {
    const identity = await resolveOpenLuraRequestIdentity(req);
    if (!identity.isAuthenticated || !identity.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    const body = await req.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 1000) : "";
    const model: Model = MODELS.includes(body?.model) ? body.model : "dalle3";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400, headers: NO_STORE });
    }

    let url: string;

    if (model === "dalle3") {
      url = await generateWithDallE(prompt);
    } else {
      url = await generateWithFal(FAL_MODEL_IDS[model], prompt);
    }

    return NextResponse.json({ url, model }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Image generate failed", err?.message);
    return NextResponse.json(
      { error: err?.message || "Generation failed" },
      { status: 500, headers: NO_STORE }
    );
  }
}