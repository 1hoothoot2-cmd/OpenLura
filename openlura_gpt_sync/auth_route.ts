import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionValue,
  getAdminSessionCookieOptions,
  getClearedAdminSessionCookieOptions,
  getCookieValue,
  isValidAdminSession,
} from "@/lib/auth/adminSession";
import { resolveOpenLuraRequestIdentity } from "@/lib/auth/requestIdentity";

export const dynamic = "force-dynamic";

const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const MAX_AUTH_REQUEST_BYTES = 8 * 1024;
const MAX_USERNAME_LENGTH = 200;
const MAX_PASSWORD_LENGTH = 1000;
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 8;
const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();

type AuthRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

function getRequestIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = req.headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function checkAuthRateLimit(req: Request): AuthRateLimitResult {
  const ip = getRequestIp(req);
  const now = Date.now();
  const existing = authRateLimitStore.get(ip);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + AUTH_RATE_LIMIT_WINDOW_MS;

    authRateLimitStore.set(ip, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      remaining: AUTH_RATE_LIMIT_MAX_ATTEMPTS - 1,
      resetAt,
    };
  }

  if (existing.count >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  authRateLimitStore.set(ip, existing);

  return {
    allowed: true,
    remaining: Math.max(0, AUTH_RATE_LIMIT_MAX_ATTEMPTS - existing.count),
    resetAt: existing.resetAt,
  };
}

function toSafeErrorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}

function logSafeError(label: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(label, {
    ...extra,
    ...toSafeErrorMeta(error),
  });
}

function getRateLimitHeaders(rateLimit: AuthRateLimitResult) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
  );

  return {
    "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
    "X-OpenLura-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining)),
    "X-OpenLura-RateLimit-Reset": String(rateLimit.resetAt),
    "Retry-After": String(retryAfterSeconds),
  };
}

function buildHeaders(rateLimit?: AuthRateLimitResult) {
  if (!rateLimit) {
    return NO_STORE_HEADERS;
  }

  return {
    ...NO_STORE_HEADERS,
    ...getRateLimitHeaders(rateLimit),
  };
}

function getContentLength(req: Request) {
  const raw = req.headers.get("content-length");

  if (!raw || !/^\d+$/.test(raw)) {
    return null;
  }

  return Number(raw);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
async function fetchSupabasePasswordSession(input: {
  username: string;
  password: string;
}) {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseAnonKey);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: input.username,
        password: input.password,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data: unknown = await res.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }

    const session = data as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown } | null;
    };

    if (
      typeof session.access_token !== "string" ||
      !session.access_token.trim()
    ) {
      return null;
    }

    return {
      accessToken: session.access_token.trim(),
      refreshToken:
        typeof session.refresh_token === "string" && session.refresh_token.trim()
          ? session.refresh_token.trim()
          : null,
      userId:
        typeof session.user?.id === "string" && session.user.id.trim()
          ? session.user.id.trim()
          : null,
    };
  } catch (error) {
    logSafeError("Supabase password session fetch failed", error, {
      hasSupabaseUrl: !!supabaseUrl,
      hasSupabaseAnonKey: !!supabaseAnonKey,
    });
    return null;
  }
}

function getSupabaseAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

function getClearedSupabaseAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

function parseAuthBody(body: unknown) {
  if (!isPlainObject(body)) {
    return null;
  }

  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  const password =
    typeof body.password === "string" ? body.password : "";

  if (
    !username ||
    !password ||
    username.length > MAX_USERNAME_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return null;
  }

  return {
    username,
    password,
  };
}

async function fetchSupabaseSignup(input: {
  email: string;
  password: string;
}) {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("apikey", supabaseAnonKey);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
      cache: "no-store",
    });

    const data: unknown = await res.json();

    if (!res.ok) {
      const errorMsg =
        data && typeof data === "object" && !Array.isArray(data)
          ? String((data as any).msg || (data as any).message || "Signup failed")
          : "Signup failed";
      return { ok: false, error: errorMsg };
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, error: "Unexpected response" };
    }

    const session = data as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown } | null;
    };

    // Email confirmation required — no token yet
    if (!session.access_token) {
      return { ok: true, requiresConfirmation: true, accessToken: null, refreshToken: null, userId: null };
    }

    return {
      ok: true,
      requiresConfirmation: false,
      accessToken: typeof session.access_token === "string" ? session.access_token.trim() : null,
      refreshToken: typeof session.refresh_token === "string" ? session.refresh_token.trim() : null,
      userId: typeof session.user?.id === "string" ? session.user.id.trim() : null,
    };
  } catch (error) {
    logSafeError("Supabase signup failed", error);
    return { ok: false, error: "Signup failed" };
  }
}

export async function POST(req: Request) {
  const rateLimit = checkAuthRateLimit(req);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many login attempts" },
      {
        status: 429,
        headers: buildHeaders(rateLimit),
      }
    );
  }

  try {
    const contentLength = getContentLength(req);

    if (
      contentLength !== null &&
      Number.isFinite(contentLength) &&
      contentLength > MAX_AUTH_REQUEST_BYTES
    ) {
      return NextResponse.json(
        { success: false, error: "Request body too large" },
        {
          status: 413,
          headers: buildHeaders(rateLimit),
        }
      );
    }

    let rawBody: unknown;

    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        {
          status: 400,
          headers: buildHeaders(rateLimit),
        }
      );
    }

    // Handle session sync (client pushes fresh Supabase tokens into httpOnly cookies)
    if (
      rawBody &&
      typeof rawBody === "object" &&
      !Array.isArray(rawBody) &&
      (rawBody as Record<string, unknown>).action === "sync"
    ) {
      const body = rawBody as Record<string, unknown>;
      const accessToken =
        typeof body.accessToken === "string" && body.accessToken.trim()
          ? body.accessToken.trim()
          : null;
      const refreshToken =
        typeof body.refreshToken === "string" && body.refreshToken.trim()
          ? body.refreshToken.trim()
          : null;

      if (!accessToken && !refreshToken) {
        return NextResponse.json(
          { success: false, error: "No token provided" },
          { status: 400, headers: buildHeaders(rateLimit) }
        );
      }

      let finalAccess: string | null = null;
      let finalRefresh = refreshToken;

      // Always prefer refreshing via refresh_token to get a verified fresh token
      if (refreshToken) {
        const refreshed = await refreshSupabaseSession(refreshToken);
        if (refreshed?.accessToken) {
          finalAccess = refreshed.accessToken;
          finalRefresh = refreshed.refreshToken ?? refreshToken;
        }
      }

      // Only fall back to raw accessToken if refresh unavailable — verify it with Supabase
      if (!finalAccess && accessToken && supabaseUrl && supabaseAnonKey) {
        try {
          const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            cache: "no-store",
          });
          if (verifyRes.ok) {
            finalAccess = accessToken;
          }
        } catch {
          // verification failed — reject
        }
      }

      if (!finalAccess) {
        return NextResponse.json(
          { success: false, error: "Token validation failed" },
          { status: 401, headers: buildHeaders(rateLimit) }
        );
      }

      const response = NextResponse.json(
        { success: true, runtime: { authenticated: true } },
        { headers: buildHeaders(rateLimit) }
      );

      response.cookies.set("sb-access-token", finalAccess, getSupabaseAuthCookieOptions());
      response.cookies.set("supabase-access-token", finalAccess, getSupabaseAuthCookieOptions());

      if (finalRefresh) {
        response.cookies.set("sb-refresh-token", finalRefresh, getSupabaseAuthCookieOptions());
      }

      return response;
    }

    // Handle signup
    if (
      rawBody &&
      typeof rawBody === "object" &&
      !Array.isArray(rawBody) &&
      (rawBody as Record<string, unknown>).action === "signup"
    ) {
      const body = rawBody as Record<string, unknown>;
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";

      const MIN_PASSWORD_LENGTH = 8;
      if (!email || !password || email.length > MAX_USERNAME_LENGTH || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        return NextResponse.json(
          { success: false, error: password.length < MIN_PASSWORD_LENGTH ? "Password must be at least 8 characters" : "Invalid email or password" },
          { status: 400, headers: buildHeaders(rateLimit) }
        );
      }

      const result = await fetchSupabaseSignup({ email, password });

      if (!result || !result.ok) {
        return NextResponse.json(
          { success: false, error: (result as any)?.error || "Signup failed" },
          { status: 400, headers: buildHeaders(rateLimit) }
        );
      }

      if (result.requiresConfirmation) {
        return NextResponse.json(
          { success: true, requiresConfirmation: true },
          { headers: buildHeaders(rateLimit) }
        );
      }

      const response = NextResponse.json(
        { success: true, runtime: { authenticated: true, userId: result.userId } },
        { headers: buildHeaders(rateLimit) }
      );

      if (result.accessToken) {
        response.cookies.set("sb-access-token", result.accessToken, getSupabaseAuthCookieOptions());
        response.cookies.set("supabase-access-token", result.accessToken, getSupabaseAuthCookieOptions());
      }
      if (result.refreshToken) {
        response.cookies.set("sb-refresh-token", result.refreshToken, getSupabaseAuthCookieOptions());
      }

      return response;
    }

    const parsedBody = parseAuthBody(rawBody);

    if (!parsedBody) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: buildHeaders(rateLimit),
        }
      );
    }

    const isAdminLogin =
      !!adminUsername &&
      parsedBody.username.toLowerCase() === adminUsername.toLowerCase();

    if (isAdminLogin) {
      if (!adminPasswordHash) {
        logSafeError(
          "OpenLura admin auth missing env",
          new Error("Admin auth not configured"),
          {
            hasAdminUsername: !!adminUsername,
            hasAdminPasswordHash: !!adminPasswordHash,
            hasAdminSessionSecret: !!process.env.ADMIN_SESSION_SECRET,
          }
        );

        return NextResponse.json(
          { success: false, error: "Admin auth not configured" },
          {
            status: 500,
            headers: buildHeaders(rateLimit),
          }
        );
      }

      const validPassword = await bcrypt.compare(
        parsedBody.password,
        adminPasswordHash
      );

      if (!validPassword) {
        return NextResponse.json(
          { success: false, error: "Invalid credentials" },
          {
            status: 401,
            headers: buildHeaders(rateLimit),
          }
        );
      }
    }

    const supabaseSession = await fetchSupabasePasswordSession({
      username: parsedBody.username,
      password: parsedBody.password,
    });

    if (!supabaseSession?.accessToken || !supabaseSession.userId) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: buildHeaders(rateLimit),
        }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        runtime: {
          authenticated: true,
          sessionType: isAdminLogin ? "personal_admin" : "user",
          userId: supabaseSession.userId,
        },
      },
      {
        headers: buildHeaders(rateLimit),
      }
    );

    if (isAdminLogin) {
      response.cookies.set(
        ADMIN_COOKIE_NAME,
        createAdminSessionValue(),
        getAdminSessionCookieOptions()
      );
    }

    response.cookies.set(
      "sb-access-token",
      supabaseSession.accessToken,
      getSupabaseAuthCookieOptions()
    );

    response.cookies.set(
      "supabase-access-token",
      supabaseSession.accessToken,
      getSupabaseAuthCookieOptions()
    );

    if (supabaseSession.refreshToken) {
      response.cookies.set(
        "sb-refresh-token",
        supabaseSession.refreshToken,
        getSupabaseAuthCookieOptions()
      );
    }

    return response;
  } catch (error) {
    logSafeError("Admin login failed", error);

    return NextResponse.json(
      { success: false, error: "Login failed" },
      {
        status: 500,
        headers: buildHeaders(rateLimit),
      }
    );
  }
}

async function refreshSupabaseSession(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  userId: string | null;
} | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  try {
    const headers = new Headers();
    headers.set("apikey", supabaseAnonKey);
    headers.set("Content-Type", "application/json");

    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    if (!res.ok) return null;

    const data: unknown = await res.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) return null;

    const session = data as {
      access_token?: unknown;
      refresh_token?: unknown;
      user?: { id?: unknown } | null;
    };

    if (typeof session.access_token !== "string" || !session.access_token.trim()) return null;

    return {
      accessToken: session.access_token.trim(),
      refreshToken:
        typeof session.refresh_token === "string" && session.refresh_token.trim()
          ? session.refresh_token.trim()
          : null,
      userId:
        typeof session.user?.id === "string" && session.user.id.trim()
          ? session.user.id.trim()
          : null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    // Token refresh flow
    if (url.searchParams.get("action") === "refresh") {
      const refreshToken = getCookieValue(req, "sb-refresh-token");

      if (!refreshToken || !supabaseUrl || !supabaseAnonKey) {
        return NextResponse.json({ success: false }, { status: 401, headers: NO_STORE_HEADERS });
      }

      const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "apikey": supabaseAnonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });

      if (!res.ok) {
        return NextResponse.json({ success: false }, { status: 401, headers: NO_STORE_HEADERS });
      }

      const data: unknown = await res.json();

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return NextResponse.json({ success: false }, { status: 401, headers: NO_STORE_HEADERS });
      }

      const session = data as { access_token?: unknown; refresh_token?: unknown };

      if (typeof session.access_token !== "string" || !session.access_token.trim()) {
        return NextResponse.json({ success: false }, { status: 401, headers: NO_STORE_HEADERS });
      }

      const newAccessToken = session.access_token.trim();
      const newRefreshToken =
        typeof session.refresh_token === "string" && session.refresh_token.trim()
          ? session.refresh_token.trim()
          : null;

      const response = NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });

      response.cookies.set("sb-access-token", newAccessToken, getSupabaseAuthCookieOptions());
      response.cookies.set("supabase-access-token", newAccessToken, getSupabaseAuthCookieOptions());

      if (newRefreshToken) {
        response.cookies.set("sb-refresh-token", newRefreshToken, getSupabaseAuthCookieOptions());
      }

      return response;
    }

    const sessionCookie = getCookieValue(req, ADMIN_COOKIE_NAME);
    const hasAdminSession = isValidAdminSession(sessionCookie);
    const identity = await resolveOpenLuraRequestIdentity(req);

    if (hasAdminSession) {
      return NextResponse.json(
        {
          authenticated: true,
          runtime: {
            sessionType: "admin",
            authenticated: true,
            userId: identity.userId || null,
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (identity.isAuthenticated && identity.userId) {
      return NextResponse.json(
        {
          authenticated: true,
          runtime: {
            sessionType: "user",
            authenticated: true,
            userId: identity.userId,
          },
        },
        {
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        authenticated: false,
        runtime: {
          sessionType: "guest",
          authenticated: false,
          userId: null,
        },
      },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    logSafeError("Admin auth GET failed", error);

    return NextResponse.json(
      {
        authenticated: false,
        error: "Auth check failed",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export async function DELETE(_req: Request) {
  try {
    const response = NextResponse.json(
      {
        success: true,
        runtime: {
          sessionType: "admin",
          clearedSession: true,
        },
      },
      {
        headers: NO_STORE_HEADERS,
      }
    );

    response.cookies.set(
      ADMIN_COOKIE_NAME,
      "",
      getClearedAdminSessionCookieOptions()
    );

    response.cookies.set(
      "sb-access-token",
      "",
      getClearedSupabaseAuthCookieOptions()
    );

    response.cookies.set(
      "supabase-access-token",
      "",
      getClearedSupabaseAuthCookieOptions()
    );

    response.cookies.set(
      "sb-refresh-token",
      "",
      getClearedSupabaseAuthCookieOptions()
    );

    response.cookies.set(
      "supabase-auth-token",
      "",
      getClearedSupabaseAuthCookieOptions()
    );

    response.cookies.set(
      "sb-auth-token",
      "",
      getClearedSupabaseAuthCookieOptions()
    );

    return response;
  } catch (error) {
    logSafeError("Admin logout failed", error);

    return NextResponse.json(
      {
        success: false,
        error: "Logout failed",
      },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}