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
          headers: NO_STORE_HEADERS,
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
          headers: NO_STORE_HEADERS,
        }
      );
    }

    if (username !== adminUsername) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const validPassword = await bcrypt.compare(password, adminPasswordHash);

    if (!validPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        username: adminUsername,
      },
      {
        headers: NO_STORE_HEADERS,
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