export type AircraftId = string & { readonly __brand: "AircraftId" };

export type AircraftCategory =
  | "passenger"
  | "cargo"
  | "business"
  | "helicopter"
  | "unknown";

export type Aircraft = Readonly<{
  id: AircraftId;
  latitudeDegrees: number;
  longitudeDegrees: number;
  headingDegrees: number | null;
  callsign: string | null;
  registration: string | null;
  altitudeMeters: number | null;
  groundSpeedMetersPerSecond: number | null;
  onGround: boolean;
  category: AircraftCategory;
  positionTimestampEpochMillis: number;
}>;

export function aircraftId(value: string): AircraftId {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new Error("Aircraft ID must not be empty");
  return normalized as AircraftId;
}
