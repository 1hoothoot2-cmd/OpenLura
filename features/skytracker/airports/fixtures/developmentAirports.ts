import type {
  AirportDetails,
  AirportSearchEntry,
} from "../domain/airport.ts";

export const DEVELOPMENT_AIRPORTS: readonly AirportSearchEntry[] = [
  {
    airport: {
      icaoCode: "EHAM",
      iataCode: "AMS",
      name: "Amsterdam Airport Schiphol",
      latitudeDegrees: 52.3086,
      longitudeDegrees: 4.7639,
      countryCode: "NL",
    },
    city: "Amsterdam",
  },
];

export function developmentAirportDetails(
  entry: AirportSearchEntry,
): AirportDetails {
  return {
    airport: entry.airport,
    city: entry.city,
    elevationMeters: null,
    timezone: null,
    runways: [],
  };
}

