import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  return {
    feedbackTableUrl: `${supabaseUrl}/rest/v1/openlura_feedback`,
    supabaseServiceRoleKey,
  };
}

export async function POST(req: Request) {
  try {
    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();
    const data = await req.json();

            const rawMessage = String(data.message ?? "").toLowerCase();

    let inferredIdeaSource = data.source ?? null;

    if (data.type === "idea") {
      if (
        rawMessage.includes("bug") ||
        rawMessage.includes("werkt niet") ||
        rawMessage.includes("error") ||
        rawMessage.includes("fout") ||
        rawMessage.includes("crash") ||
        rawMessage.includes("stuk") ||
        rawMessage.includes("kapot")
      ) {
        inferredIdeaSource = "idea_bug";
      } else if (
        rawMessage.includes("aanpassen") ||
        rawMessage.includes("aanpassing") ||
        rawMessage.includes("toevoegen") ||
        rawMessage.includes("maak") ||
        rawMessage.includes("zet") ||
        rawMessage.includes("verander") ||
        rawMessage.includes("wijzig")
      ) {
        inferredIdeaSource = "idea_adjustment";
      } else if (
        rawMessage.includes("ai") ||
        rawMessage.includes("antwoord") ||
        rawMessage.includes("reageer") ||
        rawMessage.includes("korter") ||
        rawMessage.includes("duidelijker") ||
        rawMessage.includes("beter") ||
        rawMessage.includes("leren")
      ) {
        inferredIdeaSource = "idea_feedback_learning";
      } else {
        inferredIdeaSource = "idea_adjustment";
      }
    }
    const entry = {
      chatId: data.chatId ?? null,
      msgIndex: data.msgIndex ?? null,
      type: data.type ?? null,
      message: data.message ?? null,
      userMessage: data.userMessage ?? null,
      source: inferredIdeaSource,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(feedbackTableUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      } as HeadersInit,
      body: JSON.stringify(entry),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Supabase POST failed:", res.status, errorText);

      return NextResponse.json(
        {
          success: false,
          error: "Feedback opslaan mislukt",
          supabaseStatus: res.status,
          supabaseError: errorText,
        },
        { status: 500 }
      );
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
      {
        success: false,
        error: "Feedback opslaan mislukt",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { feedbackTableUrl, supabaseServiceRoleKey } = getSupabaseConfig();

    const res = await fetch(
      `${feedbackTableUrl}?select=*&order=timestamp.desc`,
      {
        method: "GET",
        headers: {
          apikey: supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
        } as HeadersInit,
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