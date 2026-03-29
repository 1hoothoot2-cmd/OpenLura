import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "openlura_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const ADMIN_SESSION_VERSION = "v1";
const ADMIN_SESSION_SIGNATURE_HEX_LENGTH = 64;
const ADMIN_SESSION_NONCE_HEX_LENGTH = 32;
const MIN_ADMIN_SESSION_SECRET_LENGTH = 32;

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

export function isValidAdminSession(value?: string | null) {
  const parsed = parseAdminSessionValue(value);

  if (!parsed) return false;

  const expiresAtNumber = Number(parsed.expiresAt);

  if (!Number.isSafeInteger(expiresAtNumber)) return false;
  if (expiresAtNumber <= Date.now()) return false;

  const expectedSignature = signAdminSession(parsed.expiresAt, parsed.nonce);

  if (!isLowercaseHex(expectedSignature, ADMIN_SESSION_SIGNATURE_HEX_LENGTH)) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(parsed.signature, "hex"),
      Buffer.from(expectedSignature, "hex")
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