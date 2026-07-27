import {
  EMPTY_FAVORITES,
  FAVORITES_STORAGE_VERSION,
  type FavoriteAircraft,
  type FavoriteAirport,
  type SkyTrackerFavorites,
} from "../domain/favorites.ts";

export const SKYTRACKER_FAVORITES_STORAGE_KEY = "skytracker_favorites";

export class FavoritesRepository {
  private readonly storage: Pick<Storage, "getItem" | "setItem">;

  constructor(storage: Pick<Storage, "getItem" | "setItem">) {
    this.storage = storage;
  }

  load(): SkyTrackerFavorites {
    try {
      return parseFavorites(this.storage.getItem(SKYTRACKER_FAVORITES_STORAGE_KEY));
    } catch {
      return EMPTY_FAVORITES;
    }
  }

  save(favorites: SkyTrackerFavorites): SkyTrackerFavorites {
    const normalized = normalizeFavorites(favorites);
    try {
      this.storage.setItem(
        SKYTRACKER_FAVORITES_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch {
      // UI state remains usable when browser storage is unavailable.
    }
    return normalized;
  }

  toggleAircraft(favorite: FavoriteAircraft): SkyTrackerFavorites {
    const current = this.load();
    const exists = current.aircraft.some(
      (item) => item.aircraftId === favorite.aircraftId,
    );
    return this.save({
      ...current,
      aircraft: exists
        ? current.aircraft.filter(
            (item) => item.aircraftId !== favorite.aircraftId,
          )
        : [...current.aircraft, favorite],
    });
  }

  toggleAirport(favorite: FavoriteAirport): SkyTrackerFavorites {
    const current = this.load();
    const exists = current.airports.some(
      (item) => item.icaoCode === favorite.icaoCode,
    );
    return this.save({
      ...current,
      airports: exists
        ? current.airports.filter(
            (item) => item.icaoCode !== favorite.icaoCode,
          )
        : [...current.airports, favorite],
    });
  }
}

export function createBrowserFavoritesRepository() {
  return new FavoritesRepository(window.localStorage);
}

export function parseFavorites(raw: string | null): SkyTrackerFavorites {
  if (!raw) return EMPTY_FAVORITES;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== FAVORITES_STORAGE_VERSION) {
      return EMPTY_FAVORITES;
    }
    return normalizeFavorites({
      version: FAVORITES_STORAGE_VERSION,
      aircraft: Array.isArray(value.aircraft)
        ? value.aircraft.flatMap(parseAircraft)
        : [],
      airports: Array.isArray(value.airports)
        ? value.airports.flatMap(parseAirport)
        : [],
    });
  } catch {
    return EMPTY_FAVORITES;
  }
}

function normalizeFavorites(favorites: SkyTrackerFavorites): SkyTrackerFavorites {
  return {
    version: FAVORITES_STORAGE_VERSION,
    aircraft: deduplicate(favorites.aircraft, (item) => item.aircraftId).sort(
      (left, right) => left.aircraftId.localeCompare(right.aircraftId),
    ),
    airports: deduplicate(favorites.airports, (item) => item.icaoCode).sort(
      (left, right) => left.icaoCode.localeCompare(right.icaoCode),
    ),
  };
}

function parseAircraft(value: unknown): FavoriteAircraft[] {
  if (!isRecord(value) || !nonEmpty(value.aircraftId)) return [];
  return [
    {
      aircraftId: value.aircraftId.trim().toLowerCase(),
      callsign: optionalText(value.callsign),
      registration: optionalText(value.registration),
    },
  ];
}

function parseAirport(value: unknown): FavoriteAirport[] {
  if (
    !isRecord(value) ||
    !nonEmpty(value.icaoCode) ||
    !nonEmpty(value.name) ||
    !finiteRange(value.latitudeDegrees, -90, 90) ||
    !finiteRange(value.longitudeDegrees, -180, 180)
  ) {
    return [];
  }
  return [
    {
      icaoCode: value.icaoCode.trim().toUpperCase(),
      iataCode: optionalText(value.iataCode)?.toUpperCase() ?? null,
      name: value.name.trim(),
      city: optionalText(value.city),
      countryCode: optionalText(value.countryCode)?.toUpperCase() ?? null,
      latitudeDegrees: Number(value.latitudeDegrees),
      longitudeDegrees: Number(value.longitudeDegrees),
    },
  ];
}

function deduplicate<T>(items: readonly T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteRange(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}
