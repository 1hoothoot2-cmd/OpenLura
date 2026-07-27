import type {
  Aircraft,
  AircraftCategory,
  AircraftId,
} from "../domain/aircraft.ts";

export type PresentedAircraft = Readonly<{
  id: AircraftId;
  coordinates: readonly [longitude: number, latitude: number];
  rotationDegrees: number;
  hasKnownHeading: boolean;
  displayCallsign: string;
  registration: string | null;
  selected: boolean;
  onGround: boolean;
  category: AircraftCategory;
}>;

export function presentAircraft(
  aircraft: readonly Aircraft[],
  selectedAircraftId: AircraftId | null,
): readonly PresentedAircraft[] {
  return aircraft.map((item) => ({
    id: item.id,
    coordinates: [
      coordinatePrecision(item.longitudeDegrees),
      coordinatePrecision(item.latitudeDegrees),
    ],
    rotationDegrees: normalizeHeading(item.headingDegrees),
    hasKnownHeading: item.headingDegrees !== null,
    displayCallsign:
      cleanLabel(item.callsign) ?? cleanLabel(item.registration) ?? item.id.toUpperCase(),
    registration: cleanLabel(item.registration),
    selected: item.id === selectedAircraftId,
    onGround: item.onGround,
    category: item.category,
  }));
}

export function normalizeHeading(headingDegrees: number | null): number {
  if (headingDegrees === null || !Number.isFinite(headingDegrees)) return 0;
  return headingDegrees === 360 ? 0 : headingDegrees;
}

function coordinatePrecision(value: number) {
  return Number(value.toFixed(5));
}

function cleanLabel(value: string | null) {
  const cleaned = value?.trim();
  return cleaned ? cleaned.toUpperCase() : null;
}
