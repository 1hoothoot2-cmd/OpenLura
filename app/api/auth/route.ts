import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  createAdminSessionValue,
  getCookieValue,
  isValidAdminSession,
} from "@/lib/auth/adminSession";

export const dynamic = "force-dynamic";

const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!adminUsername || !adminPasswordHash) {
      console.error("OpenLura admin auth missing env:", {
        hasAdminUsername: !!adminUsername,
        hasAdminPasswordHash: !!adminPasswordHash,
        hasAdminSessionSecret:
          !!process.env.ADMIN_SESSION_SECRET ||
          !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        nodeEnv: process.env.NODE_ENV,
      });

      return NextResponse.json(
        { success: false, error: "Admin auth not configured" },
        { status: 500 }
      );
    }

    if (username !== adminUsername) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(password, adminPasswordHash);

    if (!validPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        username: adminUsername,
        runtime: {
          sessionType: "personal_environment_admin",
          authenticated: true,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

    response.cookies.set(ADMIN_COOKIE_NAME, createAdminSessionValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("Admin login failed:", error);
    return NextResponse.json(
      { success: false, error: "Login failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const sessionCookie = getCookieValue(req, ADMIN_COOKIE_NAME);

  if (!isValidAdminSession(sessionCookie)) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      username: adminUsername || "admin",
      runtime: {
        sessionType: "personal_environment_admin",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function DELETE(req: Request) {
  const hadSession = isValidAdminSession(getCookieValue(req, ADMIN_COOKIE_NAME));

  const response = NextResponse.json(
    {
      success: true,
      runtime: {
        clearedSession: hadSession,
        sessionType: "personal_environment_admin",
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );

  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}