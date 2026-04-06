import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function normalizeLanguage(input: unknown): string {
  if (typeof input !== "string") return "nl";

  const cleaned = input.trim().toLowerCase();

  if (!cleaned || cleaned === "undefined" || cleaned === "null") {
    return "nl";
  }

  const short = cleaned.split("-")[0].slice(0, 2);

  const allowed = new Set([
    "nl",
    "en",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "tr",
    "ar",
    "hi",
    "ja",
    "ko",
    "sv",
    "no",
    "da",
    "fi",
    "pl",
    "pap",
  ]);

  return allowed.has(short) ? short : "nl";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const audio = formData.get("audio");
    const rawLang = formData.get("lang");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "No audio" }, { status: 400 });
    }

    const resolvedLang = normalizeLanguage(rawLang);

    console.log("VOICE raw lang:", rawLang);
    console.log("VOICE resolved lang:", resolvedLang);
    console.log("VOICE audio meta:", {
      name: audio.name,
      type: audio.type,
      size: audio.size,
    });

    const whisperForm = new FormData();
    whisperForm.append("file", audio, audio.name || "audio.webm");
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", resolvedLang);
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
      requestedLanguage: resolvedLang,
    });
  } catch (error) {
    console.error("Voice route error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}