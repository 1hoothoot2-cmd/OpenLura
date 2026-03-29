import { getCookieValue } from "@/lib/auth/adminSession";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type ResolvedOpenLuraIdentity = {
  accessToken: string | null;
  authUser: { id?: string | null } | null;
  userId: string | null;
};

function normalizeToken(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim();

  if (!normalized) return null;
  if (normalized.length > 5000) return null;
  if (/\s/.test(normalized)) return null;

  return normalized;
}

export function getBearerTokenFromRequest(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const bearerToken = normalizeToken(bearerMatch?.[1]);

    if (bearerToken) {
      return bearerToken;
    }
  }

  const directCookieToken = normalizeToken(
    getCookieValue(req, "sb-access-token") ||
      getCookieValue(req, "supabase-access-token")
  );

  if (directCookieToken) {
    return directCookieToken;
  }

  const packedCookie =
    getCookieValue(req, "supabase-auth-token") ||
    getCookieValue(req, "sb-auth-token");

  if (!packedCookie) {
    return null;
  }

  try {
    const decoded = decodeURIComponent(packedCookie);
    const parsed = JSON.parse(decoded);

    if (typeof parsed === "string") {
      return normalizeToken(parsed);
    }

    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      return normalizeToken(parsed[0]);
    }

    if (parsed && typeof parsed === "object" && typeof parsed.access_token === "string") {
      return normalizeToken(parsed.access_token);
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!supabaseUrl || !supabaseServiceRoleKey || !accessToken) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data: unknown = await res.json();

    if (!data || typeof data !== "object") {
      return null;
    }

    const userId =
      "id" in data && typeof data.id === "string" && data.id.trim()
        ? data.id.trim()
        : null;

    if (!userId) {
      return null;
    }

    return { id: userId };
  } catch {
    console.error("Auth user fetch failed");
    return null;
  }
}

export async function resolveOpenLuraRequestIdentity(
  req: Request
): Promise<ResolvedOpenLuraIdentity> {
  const accessToken = getBearerTokenFromRequest(req);

  if (!accessToken) {
    return {
      accessToken: null,
      authUser: null,
      userId: null,
    };
  }

  const authUser = await fetchSupabaseAuthUser(accessToken);

  return {
    accessToken: authUser?.id ? accessToken : null,
    authUser,
    userId: authUser?.id || null,
  };
}

export async function resolveOpenLuraUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.userId;
}