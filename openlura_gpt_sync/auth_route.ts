import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ADMIN_COOKIE_NAME = "openlura_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const adminUsername = process.env.ADMIN_USERNAME;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
const adminSessionSecret =
  process.env.ADMIN_SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "openlura-admin-session-secret";

function signAdminSession(expiresAt: string) {
  return createHmac("sha256", adminSessionSecret).update(expiresAt).digest("hex");
}

function createAdminSessionValue() {
  const expiresAt = String(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);
  const signature = signAdminSession(expiresAt);
  return `${expiresAt}.${signature}`;
}

function isValidAdminSession(value?: string | null) {
  if (!value) return false;

  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature) return false;
  if (Number(expiresAt) <= Date.now()) return false;

  const expected = signAdminSession(expiresAt);

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!adminUsername || !adminPasswordHash) {
      console.error("OpenLura admin auth missing env:", {
        hasAdminUsername: !!adminUsername,
        hasAdminPasswordHash: !!adminPasswordHash,
        hasAdminSessionSecret: !!adminSessionSecret,
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

    console.log("OpenLura admin env loaded:", {
      username: adminUsername,
      hashLength: adminPasswordHash.length,
    });

    const validPassword = await bcrypt.compare(password, adminPasswordHash);

    if (!validPassword) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const response = NextResponse.json(
      { success: true, username: adminUsername },
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
  const sessionCookie =
    req.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`))
      ?.split("=")[1] ?? null;

  if (!isValidAdminSession(sessionCookie)) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { authenticated: true, username: adminUsername || "admin" },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export async function DELETE() {
  const response = NextResponse.json(
    { success: true },
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