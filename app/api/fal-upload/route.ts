import { NextResponse } from "next/server";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const FAL_KEY = process.env.FAL_KEY;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  try {
    const identity = await resolveOpenLuraRequestIdentity(req);
    if (!identity.isAuthenticated || !identity.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
    }

    if (!FAL_KEY) {
      return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 500, headers: NO_STORE });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400, headers: NO_STORE });
    }

    // Converteer naar base64 data URI — fal.ai accepteert dit direct
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({ url: dataUrl }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Fal upload failed:", err?.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500, headers: NO_STORE });
  }
}