export type FlightAirportInformation = Readonly<{
  icaoCode: string | null;
  iataCode: string | null;
  name: string;
}>;

export type FlightLegInformation = Readonly<{
  flightId: string;
  flightNumber: string | null;
  callsign: string | null;
  origin: FlightAirportInformation | null;
  destination: FlightAirportInformation | null;
  status: string;
}>;

export function parseFlightLegInformation(value: unknown): FlightLegInformation {
  if (!isRecord(value) || !nonEmpty(value.flightId)) {
    throw new Error("Malformed flight leg");
  }
  return {
    flightId: value.flightId.trim(),
    flightNumber: optionalText(value.flightNumber),
    callsign: optionalText(value.callsign),
    origin: parseAirport(value.origin),
    destination: parseAirport(value.destination),
    status: nonEmpty(value.status) ? value.status.trim().toUpperCase() : "UNKNOWN",
  };
}

function parseAirport(value: unknown): FlightAirportInformation | null {
  if (value == null) return null;
  if (!isRecord(value) || !nonEmpty(value.name)) {
    throw new Error("Malformed flight airport");
  }
  return {
    icaoCode: optionalText(value.icaoCode),
    iataCode: optionalText(value.iataCode),
    name: value.name.trim(),
  };
}

function optionalText(value: unknown) {
  return nonEmpty(value) ? value.trim().toUpperCase() : null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
