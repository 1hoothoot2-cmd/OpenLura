import { createHmac, timingSafeEqual } from "crypto";
import { getCookieValue } from "@/lib/auth/adminSession";

export const ANALYTICS_COOKIE_NAME = "openlura_analytics_session";
export const ANALYTICS_SESSION_MAX_AGE = 60 * 60 * 3;

const ANALYTICS_SIGNATURE_HEX_LENGTH = 64;

function getAnalyticsSessionSecret() {
  const secret =
    process.env.ANALYTICS_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "Missing ANALYTICS_SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return secret;
}

function parseAnalyticsSessionValue(value?: string | null) {
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

export function signAnalyticsSession(expiresAt: string) {
  return createHmac("sha256", getAnalyticsSessionSecret())
    .update(expiresAt)
    .digest("hex");
}

export function createAnalyticsSessionValue(now = Date.now()) {
  const expiresAt = String(now + ANALYTICS_SESSION_MAX_AGE * 1000);
  const signature = signAnalyticsSession(expiresAt);
  return `${expiresAt}.${signature}`;
}

export function isValidAnalyticsSession(value?: string | null) {
  const parsed = parseAnalyticsSessionValue(value);

  if (!parsed) return false;

  const expiresAtNumber = Number(parsed.expiresAt);

  if (!Number.isFinite(expiresAtNumber)) return false;
  if (expiresAtNumber <= Date.now()) return false;
  if (parsed.signature.length !== ANALYTICS_SIGNATURE_HEX_LENGTH) return false;

  const expected = signAnalyticsSession(parsed.expiresAt);

  if (expected.length !== parsed.signature.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(parsed.signature, "utf8"),
      Buffer.from(expected, "utf8")
    );
  } catch {
    return false;
  }
}

export function getAnalyticsSessionCookie(req: Request) {
  return getCookieValue(req, ANALYTICS_COOKIE_NAME);
}

export function getAnalyticsSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANALYTICS_SESSION_MAX_AGE,
  };
}

export function getClearedAnalyticsSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}