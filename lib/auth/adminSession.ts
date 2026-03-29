import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "openlura_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ADMIN_SESSION_VERSION = "v1";
const ADMIN_SESSION_SIGNATURE_HEX_LENGTH = 64;
const ADMIN_SESSION_NONCE_HEX_LENGTH = 32;
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;
const MAX_COOKIE_HEADER_LENGTH = 16 * 1024;
const MAX_COOKIE_VALUE_LENGTH = 2048;
const MAX_FUTURE_SESSION_SKEW_MS = 5 * 60 * 1000;

type ParsedAdminSession = {
  version: string;
  expiresAt: string;
  nonce: string;
  signature: string;
};

function getAdminSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "OpenLura admin session secret is not configured. Set ADMIN_SESSION_SECRET."
    );
  }

  if (secret.length < MIN_ADMIN_SESSION_SECRET_LENGTH) {
    throw new Error(
      `OpenLura admin session secret is too short. ADMIN_SESSION_SECRET must be at least ${MIN_ADMIN_SESSION_SECRET_LENGTH} characters.`
    );
  }

  return secret;
}

function isLowercaseHex(value: string, expectedLength: number) {
  return value.length === expectedLength && /^[a-f0-9]+$/.test(value);
}

function buildAdminSessionPayload(expiresAt: string, nonce: string) {
  return `${ADMIN_SESSION_VERSION}:${expiresAt}:${nonce}`;
}

function parseAdminSessionValue(value?: string | null): ParsedAdminSession | null {
  if (!value) return null;
  if (value.length > MAX_COOKIE_VALUE_LENGTH) return null;

  const parts = value.split(".");

  if (parts.length !== 4) return null;

  const [version, expiresAt, nonce, signature] = parts;

  if (!version || !expiresAt || !nonce || !signature) return null;
  if (version !== ADMIN_SESSION_VERSION) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (!isLowercaseHex(nonce, ADMIN_SESSION_NONCE_HEX_LENGTH)) return null;
  if (!isLowercaseHex(signature, ADMIN_SESSION_SIGNATURE_HEX_LENGTH)) return null;

  return {
    version,
    expiresAt,
    nonce,
    signature,
  };
}

export function signAdminSession(expiresAt: string, nonce: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(buildAdminSessionPayload(expiresAt, nonce))
    .digest("hex");
}

export function createAdminSessionValue(now = Date.now()) {
  const expiresAt = String(now + ADMIN_SESSION_MAX_AGE * 1000);
  const nonce = randomBytes(16).toString("hex");
  const signature = signAdminSession(expiresAt, nonce);

  return `${ADMIN_SESSION_VERSION}.${expiresAt}.${nonce}.${signature}`;
}

export function getValidatedAdminSession(value?: string | null) {
  const parsed = parseAdminSessionValue(value);

  if (!parsed) return null;

  const expiresAtNumber = Number(parsed.expiresAt);
  const maxAllowedExpiry =
    Date.now() + ADMIN_SESSION_MAX_AGE * 1000 + MAX_FUTURE_SESSION_SKEW_MS;

  if (!Number.isSafeInteger(expiresAtNumber)) return null;
  if (expiresAtNumber <= Date.now()) return null;
  if (expiresAtNumber > maxAllowedExpiry) return null;

  const expectedSignature = signAdminSession(parsed.expiresAt, parsed.nonce);

  if (!isLowercaseHex(expectedSignature, ADMIN_SESSION_SIGNATURE_HEX_LENGTH)) {
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

export function isValidAdminSession(value?: string | null) {
  return !!getValidatedAdminSession(value);
}

export function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.headers.get("cookie");

  if (!cookieHeader) return null;
  if (cookieHeader.length > MAX_COOKIE_HEADER_LENGTH) return null;

  const cookiePrefix = `${name}=`;

  for (const rawPart of cookieHeader.split(";")) {
    const part = rawPart.trim();

    if (!part.startsWith(cookiePrefix)) continue;

    const value = part.slice(cookiePrefix.length);

    if (!value || value.length > MAX_COOKIE_VALUE_LENGTH) {
      return null;
    }

    try {
      const decoded = decodeURIComponent(value);
      return decoded.length <= MAX_COOKIE_VALUE_LENGTH ? decoded : null;
    } catch {
      return value.length <= MAX_COOKIE_VALUE_LENGTH ? value : null;
    }
  }

  return null;
}

function getBaseAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function getAdminSessionCookieOptions() {
  return {
    ...getBaseAdminSessionCookieOptions(),
    maxAge: ADMIN_SESSION_MAX_AGE,
    priority: "high" as const,
  };
}

export function getClearedAdminSessionCookieOptions() {
  return {
    ...getBaseAdminSessionCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
    priority: "high" as const,
  };
}