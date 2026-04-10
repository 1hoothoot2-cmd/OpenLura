import { NextResponse } from "next/server";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response("Not configured", { status: 500 });
  }

  try {
    const body = await req.json();
    const { message, response, user_id, language, source } = body;

    if (!message || !response) {
      return new Response("Missing fields", { status: 400 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseServiceRoleKey);
    headers.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
    headers.set("Prefer", "return=minimal");

    await fetch(`${supabaseUrl}/rest/v1/openlura_conversations_log`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        user_id: user_id || null,
        message: String(message).slice(0, 500),
        response: String(response).slice(0, 1000),
        language: language || "en",
        source: source || "chat",
      }),
      cache: "no-store",
    });

    // Cleanup entries older than 7 days — non-blocking
    void (async () => {
      try {
        const deleteHeaders = new Headers();
        deleteHeaders.set("apikey", supabaseServiceRoleKey);
        deleteHeaders.set("Authorization", `Bearer ${supabaseServiceRoleKey}`);
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await fetch(
          `${supabaseUrl}/rest/v1/openlura_conversations_log?created_at=lt.${cutoff}`,
          { method: "DELETE", headers: deleteHeaders, cache: "no-store" }
        );
      } catch {}
    })();

    return NextResponse.json({ ok: true });
  } catch {
    return new Response("Failed", { status: 500 });
  }
}