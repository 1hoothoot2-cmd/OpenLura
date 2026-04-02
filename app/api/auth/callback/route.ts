import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://openlura.ai";

  if (!code) {
    return NextResponse.redirect(new URL("/chat", appUrl));
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({ auth_code: code }),
    });

    if (!res.ok) {
      return NextResponse.redirect(new URL("/chat", appUrl));
    }

    const data = await res.json();
    const accessToken = data?.access_token;
    const refreshToken = data?.refresh_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL("/chat", appUrl));
    }

    await fetch(new URL("/api/auth", appUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync",
        accessToken,
        refreshToken,
      }),
    });

    const response = NextResponse.redirect(new URL("/persoonlijke-omgeving", appUrl));

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    };

    response.cookies.set("sb-access-token", accessToken, cookieOptions);
    if (refreshToken) {
      response.cookies.set("sb-refresh-token", refreshToken, cookieOptions);
    }

    return response;
  } catch {
    return NextResponse.redirect(new URL("/chat", appUrl));
  }
}
