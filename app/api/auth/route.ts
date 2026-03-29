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

const SESSION_TYPE = "personal_environment_admin";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 8;
const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();

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

function checkAuthRateLimit(req: Request) {
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

export async function POST(req: Request) {
  const rateLimit = checkAuthRateLimit(req);

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
    );

    return NextResponse.json(
      { success: false, error: "Too many login attempts" },
      {
        status: 429,
        headers: {
          ...NO_STORE_HEADERS,
          "Retry-After": String(retryAfterSeconds),
          "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
          "X-OpenLura-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body" },
        {
          status: 400,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const parsedBody = body as {
      username?: unknown;
      password?: unknown;
    };

    const username =
      typeof parsedBody.username === "string" ? parsedBody.username.trim() : "";
    const password =
      typeof parsedBody.password === "string" ? parsedBody.password : "";

          if (
      !username ||
      !password ||
      username.length > 200 ||
      password.length > 1000
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: {
            ...NO_STORE_HEADERS,
            "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    if (!adminUsername || !adminPasswordHash) {
      console.error("OpenLura admin auth missing env:", {
        hasAdminUsername: !!adminUsername,
        hasAdminPasswordHash: !!adminPasswordHash,
        hasAdminSessionSecret: !!process.env.ADMIN_SESSION_SECRET,
        nodeEnv: process.env.NODE_ENV,
      });

      return NextResponse.json(
        { success: false, error: "Admin auth not configured" },
        {
          status: 500,
          headers: {
  ...NO_STORE_HEADERS,
  "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
  "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
},
        }
      );
    }

    if (username !== adminUsername) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: {
            ...NO_STORE_HEADERS,
            "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    const validPassword = await bcrypt.compare(password, adminPasswordHash);

    if (!validPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: {
            ...NO_STORE_HEADERS,
            "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
            "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
          },
        }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        username: adminUsername,
      },
      {
        headers: {
          ...NO_STORE_HEADERS,
          "X-OpenLura-RateLimit-Limit": String(AUTH_RATE_LIMIT_MAX_ATTEMPTS),
          "X-OpenLura-RateLimit-Remaining": String(rateLimit.remaining),
        },
      }
    );

    response.cookies.set(
  ADMIN_COOKIE_NAME,
  createAdminSessionValue(),
  getAdminSessionCookieOptions()
);

    return response;
  } catch (error) {
    console.error("Admin login failed:", toSafeErrorMeta(error));

    return NextResponse.json(
      { success: false, error: "Login failed" },
      {
        status: 500,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}

export async function GET(req: Request) {
  const sessionCookie = getCookieValue(req, ADMIN_COOKIE_NAME);

  if (!isValidAdminSession(sessionCookie)) {
    return NextResponse.json(
      { authenticated: false },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      username: adminUsername || "admin",
    },
    {
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function DELETE(req: Request) {
  const hadSession = isValidAdminSession(getCookieValue(req, ADMIN_COOKIE_NAME));

  const response = NextResponse.json(
    {
      success: true,
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
}