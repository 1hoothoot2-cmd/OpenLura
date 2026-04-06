import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const lang = (formData.get("lang") as string) || "nl";

    if (!audio) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audio, "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", lang.slice(0, 2)); // "nl", "en", "de", etc.

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperForm,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Whisper error:", err);
      return NextResponse.json({ error: "Whisper failed" }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ text: data.text || "" });
  } catch (error) {
    console.error("Voice route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}