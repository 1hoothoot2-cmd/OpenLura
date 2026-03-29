import { getCookieValue } from "@/lib/auth/adminSession";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ResolvedOpenLuraIdentity = {
  accessToken: string | null;
  authUser: { id?: string | null } | null;
  userId: string | null;
};

const MAX_TOKEN_LENGTH = 5000;

function toSafeErrorMeta(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    message: "Unknown error",
  };
}

function logSafeError(label: string, error: unknown, extra?: Record<string, unknown>) {
  console.error(label, {
    ...extra,
    ...toSafeErrorMeta(error),
  });
}

function normalizeToken(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim();

  if (!normalized) return null;
  if (normalized.length > MAX_TOKEN_LENGTH) return null;
  if (/\s/.test(normalized)) return null;

  return normalized;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPackedCookieToken(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed === "string") {
      return normalizeToken(parsed);
    }

    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      return normalizeToken(parsed[0]);
    }

    if (
      isPlainObject(parsed) &&
      typeof parsed.access_token === "string"
    ) {
      return normalizeToken(parsed.access_token);
    }
  } catch {
    return null;
  }

  return null;
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

  return getPackedCookieToken(packedCookie);
}

export async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!supabaseUrl || !supabaseAnonKey || !accessToken) {
    return null;
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data: unknown = await res.json();

    if (!isPlainObject(data)) {
      return null;
    }

    const userId =
      typeof data.id === "string" && data.id.trim()
        ? data.id.trim()
        : null;

    if (!userId) {
      return null;
    }

    return { id: userId };
  } catch (error) {
    logSafeError("OpenLura auth user fetch failed", error);
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

  if (!authUser?.id) {
    return {
      accessToken: null,
      authUser: null,
      userId: null,
    };
  }

  return {
    accessToken,
    authUser,
    userId: authUser.id,
  };
}

export async function resolveOpenLuraUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.userId;
}