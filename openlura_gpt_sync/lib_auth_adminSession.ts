import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "openlura_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function getAdminSessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "openlura-admin-session-secret"
  );
}

export function signAdminSession(expiresAt: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(expiresAt)
    .digest("hex");
}

export function createAdminSessionValue() {
  const expiresAt = String(Date.now() + ADMIN_SESSION_MAX_AGE * 1000);
  const signature = signAdminSession(expiresAt);
  return `${expiresAt}.${signature}`;
}

export function isValidAdminSession(value?: string | null) {
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

export function getCookieValue(req: Request, name: string) {
  return (
    req.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.split("=")[1] ?? null
  );
}