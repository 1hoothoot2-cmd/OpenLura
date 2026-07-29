import {
  FAVORITES_STORAGE_VERSION,
  type FavoriteAircraft,
  type FavoriteAirport,
  type SkyTrackerFavorites,
} from "../../favorites/domain/favorites.ts";
import type {
  PersonalFavorite,
  PersonalFavorites,
} from "./favorites.ts";

export function toPersonalFavorites(
  favorites: SkyTrackerFavorites,
  nowEpochMillis: number,
): PersonalFavorites {
  return {
    aircraft: favorites.aircraft.map((item) => ({
      kind: "aircraft",
      stableId: item.aircraftId,
      label: item.callsign ?? item.registration,
      addedAtEpochMillis: nowEpochMillis,
    })),
    airports: favorites.airports.map((item) => ({
      kind: "airport",
      stableId: item.icaoCode,
      label: item.name,
      addedAtEpochMillis: nowEpochMillis,
    })),
    airlines: [],
    flights: [],
  };
}

export function mergeBrowserFavorites(
  local: SkyTrackerFavorites,
  remote: PersonalFavorites,
): SkyTrackerFavorites {
  const remoteAircraft = remote.aircraft.flatMap(toFavoriteAircraft);
  const remoteAirports = remote.airports.flatMap(toFavoriteAirport);

  return {
    version: FAVORITES_STORAGE_VERSION,
    aircraft: deduplicate(
      [...remoteAircraft, ...local.aircraft],
      (item) => item.aircraftId.toLowerCase(),
    ),
    airports: deduplicate(
      [...remoteAirports, ...local.airports],
      (item) => item.icaoCode.toUpperCase(),
    ),
  };
}

function toFavoriteAircraft(item: PersonalFavorite): FavoriteAircraft[] {
  if (item.kind !== "aircraft" || !item.stableId.trim()) return [];
  return [{
    aircraftId: item.stableId.trim().toLowerCase(),
    callsign: item.label?.trim() || null,
    registration: null,
  }];
}

function toFavoriteAirport(item: PersonalFavorite): FavoriteAirport[] {
  if (
    item.kind !== "airport" ||
    !item.stableId.trim() ||
    !item.label?.trim()
  ) {
    return [];
  }
  return [{
    icaoCode: item.stableId.trim().toUpperCase(),
    iataCode: null,
    name: item.label.trim(),
    city: null,
    countryCode: null,
    latitudeDegrees: 0,
    longitudeDegrees: 0,
  }];
}

function deduplicate<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}
