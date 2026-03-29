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

export const dynamic = "force-dynamic";

const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

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

    if (!adminUsername || !adminPasswordHash) {
      logSafeError("OpenLura admin auth missing env", new Error("Admin auth not configured"), {
        hasAdminUsername: !!adminUsername,
        hasAdminPasswordHash: !!adminPasswordHash,
        hasAdminSessionSecret: !!process.env.ADMIN_SESSION_SECRET,
      });

      return NextResponse.json(
        { success: false, error: "Admin auth not configured" },
        {
          status: 500,
          headers: buildHeaders(rateLimit),
        }
      );
    }

    if (parsedBody.username !== adminUsername) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
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

    const response = NextResponse.json(
      {
        success: true,
        runtime: {
          authenticated: true,
          sessionType: "admin",
        },
      },
      {
        headers: buildHeaders(rateLimit),
      }
    );

    response.cookies.set(
      ADMIN_COOKIE_NAME,
      createAdminSessionValue(),
      getAdminSessionCookieOptions()
    );

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

export async function GET(req: Request) {
  try {
    const sessionCookie = getCookieValue(req, ADMIN_COOKIE_NAME);

    if (!isValidAdminSession(sessionCookie)) {
      return NextResponse.json(
        {
          authenticated: false,
          runtime: {
            sessionType: "admin",
            authenticated: false,
          },
        },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        runtime: {
          sessionType: "admin",
          authenticated: true,
        },
      },
      {
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