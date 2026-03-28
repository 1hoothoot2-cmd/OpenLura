import { getCookieValue } from "@/lib/auth/adminSession";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getBearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch?.[1]) return bearerMatch[1].trim();

  const directCookie =
    getCookieValue(req, "sb-access-token") ||
    getCookieValue(req, "supabase-access-token");

  if (directCookie) return decodeURIComponent(directCookie);

  const packedCookie =
    getCookieValue(req, "supabase-auth-token") ||
    getCookieValue(req, "sb-auth-token");

  if (!packedCookie) return null;

  try {
    const decoded = decodeURIComponent(packedCookie);
    const parsed = JSON.parse(decoded);

    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    if (typeof parsed?.access_token === "string") return parsed.access_token;
  } catch {}

  return null;
}

export async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !accessToken) return null;

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;

    return await res.json();
  } catch (error) {
    console.error("Auth user fetch failed:", error);
    return null;
  }
}

export async function resolveOpenLuraRequestIdentity(req: Request) {
  const accessToken = getBearerTokenFromRequest(req);
  const authUser = await fetchSupabaseAuthUser(accessToken);

  const headerUserId =
    req.headers.get("x-openlura-user-id") ||
    req.headers.get("x-user-id");

  return {
    accessToken,
    authUser,
    headerUserId: headerUserId || null,
    userId: authUser?.id || headerUserId || null,
  };
}

export async function resolveOpenLuraUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.userId;
}