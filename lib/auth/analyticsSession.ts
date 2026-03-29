import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getCookieValue } from "@/lib/auth/adminSession";

export const ANALYTICS_COOKIE_NAME = "openlura_analytics_session";
export const ANALYTICS_SESSION_MAX_AGE = 60 * 60 * 3;

const ANALYTICS_SESSION_VERSION = "v1";
const ANALYTICS_SIGNATURE_HEX_LENGTH = 64;
const ANALYTICS_NONCE_HEX_LENGTH = 32;
const MIN_ANALYTICS_SESSION_SECRET_LENGTH = 32;
const MAX_ANALYTICS_COOKIE_VALUE_LENGTH = 2048;
const MAX_FUTURE_SESSION_SKEW_MS = 5 * 60 * 1000;

type ParsedAnalyticsSession = {
  version: string;
  expiresAt: string;
  nonce: string;
  signature: string;
};

function getAnalyticsSessionSecret() {
  const secret = process.env.ANALYTICS_SESSION_SECRET;

  if (!secret) {
    throw new Error("Missing ANALYTICS_SESSION_SECRET");
  }

  if (secret.length < MIN_ANALYTICS_SESSION_SECRET_LENGTH) {
    throw new Error(
      `ANALYTICS_SESSION_SECRET must be at least ${MIN_ANALYTICS_SESSION_SECRET_LENGTH} characters`
    );
  }

  return secret;
}

function isLowercaseHex(value: string, expectedLength: number) {
  return value.length === expectedLength && /^[a-f0-9]+$/.test(value);
}

function buildAnalyticsSessionPayload(expiresAt: string, nonce: string) {
  return `${ANALYTICS_SESSION_VERSION}:${expiresAt}:${nonce}`;
}

function parseAnalyticsSessionValue(
  value?: string | null
): ParsedAnalyticsSession | null {
  if (!value) return null;
  if (value.length > MAX_ANALYTICS_COOKIE_VALUE_LENGTH) return null;

  const parts = value.split(".");

  if (parts.length !== 4) return null;

  const [version, expiresAt, nonce, signature] = parts;

  if (!version || !expiresAt || !nonce || !signature) return null;
  if (version !== ANALYTICS_SESSION_VERSION) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (!isLowercaseHex(nonce, ANALYTICS_NONCE_HEX_LENGTH)) return null;
  if (!isLowercaseHex(signature, ANALYTICS_SIGNATURE_HEX_LENGTH)) return null;

  return {
    version,
    expiresAt,
    nonce,
    signature,
  };
}

export function signAnalyticsSession(expiresAt: string, nonce: string) {
  return createHmac("sha256", getAnalyticsSessionSecret())
    .update(buildAnalyticsSessionPayload(expiresAt, nonce))
    .digest("hex");
}

export function createAnalyticsSessionValue(now = Date.now()) {
  const expiresAt = String(now + ANALYTICS_SESSION_MAX_AGE * 1000);
  const nonce = randomBytes(16).toString("hex");
  const signature = signAnalyticsSession(expiresAt, nonce);

  return `${ANALYTICS_SESSION_VERSION}.${expiresAt}.${nonce}.${signature}`;
}

export function getValidatedAnalyticsSession(value?: string | null) {
  const parsed = parseAnalyticsSessionValue(value);

  if (!parsed) return null;

  const expiresAtNumber = Number(parsed.expiresAt);
  const maxAllowedExpiry =
    Date.now() + ANALYTICS_SESSION_MAX_AGE * 1000 + MAX_FUTURE_SESSION_SKEW_MS;

  if (!Number.isSafeInteger(expiresAtNumber)) return null;
  if (expiresAtNumber <= Date.now()) return null;
  if (expiresAtNumber > maxAllowedExpiry) return null;

  const expectedSignature = signAnalyticsSession(parsed.expiresAt, parsed.nonce);

  if (!isLowercaseHex(expectedSignature, ANALYTICS_SIGNATURE_HEX_LENGTH)) {
    return null;
  }

  try {
    const providedSignatureBuffer = Buffer.from(parsed.signature, "hex");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

    if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
      return null;
    }

    const isValid = timingSafeEqual(
      providedSignatureBuffer,
      expectedSignatureBuffer
    );

    return isValid ? parsed : null;
  } catch {
    return null;
  }
}

export function isValidAnalyticsSession(value?: string | null) {
  return !!getValidatedAnalyticsSession(value);
}

export function getAnalyticsSessionCookie(req: Request) {
  return getCookieValue(req, ANALYTICS_COOKIE_NAME);
}

function getBaseAnalyticsSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function getAnalyticsSessionCookieOptions() {
  return {
    ...getBaseAnalyticsSessionCookieOptions(),
    maxAge: ANALYTICS_SESSION_MAX_AGE,
    priority: "high" as const,
  };
}

export function getClearedAnalyticsSessionCookieOptions() {
  return {
    ...getBaseAnalyticsSessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}