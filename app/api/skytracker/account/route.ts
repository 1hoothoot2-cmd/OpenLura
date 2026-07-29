import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import {
  EMPTY_FAVORITES,
  FAVORITES_STORAGE_VERSION,
  type SkyTrackerFavorites,
} from "@/features/skytracker/favorites/domain/favorites";
import {
  mergeBrowserFavorites,
  toPersonalFavorites,
} from "@/features/skytracker/personal-platform/domain/accountSync";
import {
  SupabaseFavoritesRepository,
  SupabaseProfileRepository,
  createSupabaseRepositoryConfig,
  ensureAccountProfile,
} from "@/features/skytracker/personal-platform/infrastructure/supabaseRepositories";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const MAX_REQUEST_BYTES = 32 * 1024;

export async function GET(request: Request) {
  const identity = await requireOpenLuraIdentity(request);
  if (!identity.ok) {
    return NextResponse.json(
      { mode: "guest", authenticated: false },
      { headers: NO_STORE_HEADERS },
    );
  }
  try {
    const config = createSupabaseRepositoryConfig(identity.identity.accessToken);
    const profileRepository = new SupabaseProfileRepository(config);
    const favoritesRepository = new SupabaseFavoritesRepository(config);
    const [profile, favorites] = await Promise.all([
      ensureAccountProfile(profileRepository, identity.identity.userId),
      favoritesRepository.getForUser(identity.identity.userId),
    ]);
    return NextResponse.json(
      {
        mode: "account",
        authenticated: true,
        profile,
        favorites,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Account data is temporarily unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export async function PUT(request: Request) {
  const identity = await requireOpenLuraIdentity(request);
  if (!identity.ok) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: "Request body too large" },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }
  try {
    const body = await request.json() as { favorites?: unknown };
    const localFavorites = parseBrowserFavorites(body.favorites);
    const config = createSupabaseRepositoryConfig(identity.identity.accessToken);
    const profileRepository = new SupabaseProfileRepository(config);
    const favoritesRepository = new SupabaseFavoritesRepository(config);
    await ensureAccountProfile(profileRepository, identity.identity.userId);
    const remoteFavorites = await favoritesRepository.getForUser(
      identity.identity.userId,
    );
    const mergedBrowserFavorites = mergeBrowserFavorites(
      localFavorites,
      remoteFavorites,
    );
    const mergedPersonalFavorites = toPersonalFavorites(
      mergedBrowserFavorites,
      Date.now(),
    );
    await favoritesRepository.saveForUser(
      identity.identity.userId,
      mergedPersonalFavorites,
    );
    return NextResponse.json(
      {
        favorites: mergedBrowserFavorites,
        synced: true,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Favorites could not be synchronized" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }
}

function parseBrowserFavorites(value: unknown): SkyTrackerFavorites {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_FAVORITES;
  }
  const input = value as Partial<SkyTrackerFavorites>;
  return {
    version: FAVORITES_STORAGE_VERSION,
    aircraft: Array.isArray(input.aircraft)
      ? input.aircraft.slice(0, 250).filter((item) => !!item?.aircraftId)
      : [],
    airports: Array.isArray(input.airports)
      ? input.airports.slice(0, 250).filter((item) => !!item?.icaoCode)
      : [],
  };
}
