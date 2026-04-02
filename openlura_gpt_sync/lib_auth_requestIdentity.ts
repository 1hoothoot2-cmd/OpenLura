import { getCookieValue } from "@/lib/auth/adminSession";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type ResolvedOpenLuraIdentity = {
  accessToken: string | null;
  authUser: { id?: string | null } | null;
  userId: string | null;
  isAuthenticated: boolean;
};

const requestIdentityCache = new WeakMap<Request, Promise<ResolvedOpenLuraIdentity>>();

type RequireOpenLuraIdentityResult =
  | {
      ok: true;
      identity: {
        accessToken: string;
        authUser: { id: string };
        userId: string;
        isAuthenticated: true;
      };
    }
  | {
      ok: false;
      reason: "unauthenticated" | "misconfigured";
    };

function hasSupabaseAuthConfig() {
  return !!(supabaseUrl && supabaseAnonKey);
}

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

function parseRequestCookies(req: Request) {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = new Map<string, string>();

  for (const part of cookieHeader.split(";")) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const separatorIndex = trimmedPart.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = trimmedPart.slice(0, separatorIndex).trim();
    const value = trimmedPart.slice(separatorIndex + 1).trim();

    if (!name) continue;
    cookies.set(name, value);
  }

  return cookies;
}

function getChunkedCookieValue(cookies: Map<string, string>, baseName: string) {
  const directValue = cookies.get(baseName);

  if (directValue) {
    return directValue;
  }

  const chunkEntries = [...cookies.entries()]
    .map(([name, value]) => {
      const match = name.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.(\\d+)$`));

      if (!match) {
        return null;
      }

      return {
        index: Number(match[1]),
        value,
      };
    })
    .filter(
      (entry): entry is { index: number; value: string } =>
        !!entry && Number.isInteger(entry.index) && entry.index >= 0
    )
    .sort((a, b) => a.index - b.index);

  if (chunkEntries.length === 0) {
    return null;
  }

  return chunkEntries.map((entry) => entry.value).join("");
}

function getSupabaseCookieValue(
  req: Request,
  predicate: (cookieName: string) => boolean
) {
  const cookies = parseRequestCookies(req);
  const cookieNames = [...cookies.keys()];

  const directMatch = cookieNames.find(predicate);

  if (directMatch) {
    return getChunkedCookieValue(cookies, directMatch);
  }

  const chunkBaseMatch = cookieNames
    .map((cookieName) => {
      const match = cookieName.match(/^(.*)\.(\d+)$/);
      return match ? match[1] : null;
    })
    .filter((baseName): baseName is string => !!baseName)
    .find((baseName) => predicate(baseName));

  if (!chunkBaseMatch) {
    return null;
  }

  return getChunkedCookieValue(cookies, chunkBaseMatch);
}

function getPackedCookieToken(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    const parsed: unknown = JSON.parse(decoded);

    if (typeof parsed === "string") {
      return normalizeToken(parsed);
    }

    if (Array.isArray(parsed)) {
      if (typeof parsed[0] === "string") {
        return normalizeToken(parsed[0]);
      }

      if (isPlainObject(parsed[0])) {
        const firstItem = parsed[0];

        if (typeof firstItem.access_token === "string") {
          return normalizeToken(firstItem.access_token);
        }

        if (
          isPlainObject(firstItem.currentSession) &&
          typeof firstItem.currentSession.access_token === "string"
        ) {
          return normalizeToken(firstItem.currentSession.access_token);
        }

        if (
          isPlainObject(firstItem.session) &&
          typeof firstItem.session.access_token === "string"
        ) {
          return normalizeToken(firstItem.session.access_token);
        }
      }
    }

    if (isPlainObject(parsed)) {
      if (typeof parsed.access_token === "string") {
        return normalizeToken(parsed.access_token);
      }

      if (
        isPlainObject(parsed.currentSession) &&
        typeof parsed.currentSession.access_token === "string"
      ) {
        return normalizeToken(parsed.currentSession.access_token);
      }

      if (
        isPlainObject(parsed.session) &&
        typeof parsed.session.access_token === "string"
      ) {
        return normalizeToken(parsed.session.access_token);
      }
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
      getCookieValue(req, "supabase-access-token") ||
      getSupabaseCookieValue(
        req,
        (cookieName) =>
          /^sb-[a-z0-9_-]+-access-token$/i.test(cookieName) ||
          /^supabase-[a-z0-9_-]+-access-token$/i.test(cookieName)
      )
  );

  if (directCookieToken) {
    return directCookieToken;
  }

  const packedCookie =
    getCookieValue(req, "supabase-auth-token") ||
    getCookieValue(req, "sb-auth-token") ||
    getSupabaseCookieValue(
      req,
      (cookieName) =>
        /^sb-[a-z0-9_-]+-auth-token$/i.test(cookieName) ||
        /^supabase-[a-z0-9_-]+-auth-token$/i.test(cookieName)
    );

  if (!packedCookie) {
    return null;
  }

  return getPackedCookieToken(packedCookie);
}

export async function fetchSupabaseAuthUser(accessToken?: string | null) {
  if (!hasSupabaseAuthConfig() || !accessToken || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  try {
    const headers = new Headers();
    headers.set("apikey", supabaseAnonKey);
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("Accept", "application/json");

    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers,
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
    logSafeError("OpenLura auth user fetch failed", error, {
      hasAccessToken: !!accessToken,
      hasSupabaseAuthConfig: hasSupabaseAuthConfig(),
    });
    return null;
  }
}

export async function resolveOpenLuraRequestIdentity(
  req: Request
): Promise<ResolvedOpenLuraIdentity> {
  const cached = requestIdentityCache.get(req);

  if (cached) {
    return cached;
  }

  const pendingIdentity = (async (): Promise<ResolvedOpenLuraIdentity> => {
    const accessToken = getBearerTokenFromRequest(req);

    if (!accessToken) {
      return {
        accessToken: null,
        authUser: null,
        userId: null,
        isAuthenticated: false,
      };
    }

    const authUser = await fetchSupabaseAuthUser(accessToken);

    if (!authUser?.id) {
      return {
        accessToken: null,
        authUser: null,
        userId: null,
        isAuthenticated: false,
      };
    }

    return {
      accessToken,
      authUser,
      userId: authUser.id,
      isAuthenticated: true,
    };
  })();

  requestIdentityCache.set(req, pendingIdentity);

  try {
    return await pendingIdentity;
  } catch (error) {
    requestIdentityCache.delete(req);
    logSafeError("OpenLura request identity resolution failed", error);
    return {
      accessToken: null,
      authUser: null,
      userId: null,
      isAuthenticated: false,
    };
  }
}

export async function requireOpenLuraIdentity(
  req: Request
): Promise<RequireOpenLuraIdentityResult> {
  if (!hasSupabaseAuthConfig()) {
    logSafeError(
      "OpenLura identity resolution misconfigured",
      new Error("Missing Supabase auth config")
    );

    return {
      ok: false,
      reason: "misconfigured",
    };
  }

  const identity = await resolveOpenLuraRequestIdentity(req);

  if (
    !identity.isAuthenticated ||
    !identity.accessToken ||
    !identity.authUser ||
    !identity.authUser.id ||
    !identity.userId
  ) {
    return {
      ok: false,
      reason: "unauthenticated",
    };
  }

  if (identity.authUser.id !== identity.userId) {
    logSafeError(
      "OpenLura identity mismatch detected",
      new Error("Resolved auth user id mismatch"),
      {
        authUserId: identity.authUser.id,
        userId: identity.userId,
      }
    );

    return {
      ok: false,
      reason: "unauthenticated",
    };
  }

  return {
    ok: true,
    identity: {
      accessToken: identity.accessToken,
      authUser: { id: identity.authUser.id },
      userId: identity.userId,
      isAuthenticated: true,
    },
  };
}

export async function resolveOpenLuraUserId(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.isAuthenticated ? identity.userId : null;
}

export async function resolveOpenLuraAccessToken(req: Request) {
  const identity = await resolveOpenLuraRequestIdentity(req);
  return identity.isAuthenticated ? identity.accessToken : null;
}