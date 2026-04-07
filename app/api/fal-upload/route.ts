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

    // Upload naar fal.ai storage
    const bytes = await file.arrayBuffer();
    const res = await fetch("https://fal.run/fal-ai/storage/upload", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": file.type || "image/jpeg",
      },
      body: bytes,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Fal upload error:", err);
      return NextResponse.json({ error: "Upload failed" }, { status: 500, headers: NO_STORE });
    }

    const data = await res.json();
    const url = data?.url || data?.access_url;

    if (!url) {
      return NextResponse.json({ error: "No URL returned" }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json({ url }, { headers: NO_STORE });
  } catch (err: any) {
    console.error("Fal upload failed:", err?.message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500, headers: NO_STORE });
  }
}