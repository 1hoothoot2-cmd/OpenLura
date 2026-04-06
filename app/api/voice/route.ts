import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    console.log("VOICE audio meta:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
    });

    const whisperForm = new FormData();
    whisperForm.append("file", audio, audio.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("task", "transcribe");
    whisperForm.append("response_format", "verbose_json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperForm,
    });

    const rawText = await res.text();

    if (!res.ok) {
      console.error("Whisper error:", rawText);
      return NextResponse.json(
        { error: "Whisper failed", details: rawText },
        { status: 500 }
      );
    }

    const data = JSON.parse(rawText);

    console.log("WHISPER detected language:", data.language);

    return NextResponse.json({
      text: data.text || "",
      detectedLanguage: data.language || null,
    });
  } catch (error) {
    console.error("Voice route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}