import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const feedbackTableUrl = `${supabaseUrl}/rest/v1/openlura_feedback`;

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const entry = {
      chatId: data.chatId ?? null,
      msgIndex: data.msgIndex ?? null,
      type: data.type ?? null,
      message: data.message ?? null,
      userMessage: data.userMessage ?? null,
      source: data.source ?? null,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(feedbackTableUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(entry),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || "Supabase insert failed");
    }

    const saved = await res.json();

    return NextResponse.json(
      { success: true, item: saved?.[0] ?? entry },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Feedback POST failed:", error);
    return NextResponse.json(
      { success: false, error: "Feedback opslaan mislukt" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const res = await fetch(
      `${feedbackTableUrl}?select=*&order=timestamp.desc`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase GET failed:", res.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: "Feedback ophalen mislukt",
          supabaseStatus: res.status,
          supabaseError: errorText,
        },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Feedback GET failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Feedback ophalen mislukt",
        details: String(error),
      },
      { status: 500 }
    );
  }
}