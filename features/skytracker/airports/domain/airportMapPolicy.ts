import type { AirportDetails } from "./airport.ts";

export type AirportMapFocus = Readonly<{
  longitudeDegrees: number;
  latitudeDegrees: number;
  stopFollowing: true;
  preserveAircraftSelection: true;
}>;

export function createAirportMapFocus(
  details: AirportDetails,
): AirportMapFocus {
  return {
    longitudeDegrees: details.airport.longitudeDegrees,
    latitudeDegrees: details.airport.latitudeDegrees,
    stopFollowing: true,
    preserveAircraftSelection: true,
  };
}

