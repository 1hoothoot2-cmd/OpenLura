import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "openlura_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ADMIN_SESSION_SIGNATURE_HEX_LENGTH = 64;

function getAdminSessionSecret() {
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "OpenLura admin session secret is not configured. Set ADMIN_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return secret;
}

function parseAdminSessionValue(value?: string | null) {
  if (!value) return null;

  const separatorIndex = value.indexOf(".");
  if (separatorIndex <= 0) return null;

  const expiresAt = value.slice(0, separatorIndex);
  const signature = value.slice(separatorIndex + 1);

  if (!expiresAt || !signature) return null;

  return {
    expiresAt,
    signature,
  };
}

export function signAdminSession(expiresAt: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(expiresAt)
    .digest("hex");
}

export function createAdminSessionValue(now = Date.now()) {
  const expiresAt = String(now + ADMIN_SESSION_MAX_AGE * 1000);
  const signature = signAdminSession(expiresAt);
  return `${expiresAt}.${signature}`;
}

export function isValidAdminSession(value?: string | null) {
  const parsed = parseAdminSessionValue(value);

  if (!parsed) return false;

  const expiresAtNumber = Number(parsed.expiresAt);

  if (!Number.isFinite(expiresAtNumber)) return false;
  if (expiresAtNumber <= Date.now()) return false;
  if (parsed.signature.length !== ADMIN_SESSION_SIGNATURE_HEX_LENGTH) {
    return false;
  }

  const expected = signAdminSession(parsed.expiresAt);

  if (expected.length !== parsed.signature.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(parsed.signature, "utf8"),
      Buffer.from(expected, "utf8")
    );
  } catch {
    return false;
  }
}

export function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookiePrefix = `${name}=`;

  for (const rawPart of cookieHeader.split(";")) {
    const part = rawPart.trim();

    if (!part.startsWith(cookiePrefix)) continue;

    const value = part.slice(cookiePrefix.length);

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  };
}

export function getClearedAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}