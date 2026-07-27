import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import type { AirportDetails } from "../../airports/domain/airport.ts";

export const FAVORITES_STORAGE_VERSION = 1;

export type FavoriteAircraft = Readonly<{
  aircraftId: string;
  callsign: string | null;
  registration: string | null;
}>;

export type FavoriteAirport = Readonly<{
  icaoCode: string;
  iataCode: string | null;
  name: string;
  city: string | null;
  countryCode: string | null;
  latitudeDegrees: number;
  longitudeDegrees: number;
}>;

export type SkyTrackerFavorites = Readonly<{
  version: typeof FAVORITES_STORAGE_VERSION;
  aircraft: readonly FavoriteAircraft[];
  airports: readonly FavoriteAirport[];
}>;

export const EMPTY_FAVORITES: SkyTrackerFavorites = {
  version: FAVORITES_STORAGE_VERSION,
  aircraft: [],
  airports: [],
};

export function favoriteAircraftSnapshot(aircraft: Aircraft): FavoriteAircraft {
  return {
    aircraftId: aircraft.id,
    callsign: clean(aircraft.callsign),
    registration: clean(aircraft.registration),
  };
}

export function favoriteAirportSnapshot(details: AirportDetails): FavoriteAirport {
  const icaoCode = details.airport.icaoCode?.trim().toUpperCase();
  if (!icaoCode) throw new Error("Favorite airports require an ICAO code");
  return {
    icaoCode,
    iataCode: clean(details.airport.iataCode)?.toUpperCase() ?? null,
    name: details.airport.name.trim(),
    city: clean(details.city),
    countryCode: clean(details.airport.countryCode)?.toUpperCase() ?? null,
    latitudeDegrees: details.airport.latitudeDegrees,
    longitudeDegrees: details.airport.longitudeDegrees,
  };
}

function clean(value: string | null) {
  return value?.trim() || null;
}

