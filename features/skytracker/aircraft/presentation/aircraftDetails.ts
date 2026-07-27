import type { Aircraft, AircraftCategory } from "../domain/aircraft.ts";

export type AircraftDetailItem = Readonly<{
  label: string;
  value: string;
}>;

export function aircraftDetailItems(aircraft: Aircraft): readonly AircraftDetailItem[] {
  return [
    { label: "Callsign", value: text(aircraft.callsign) },
    { label: "Registration", value: text(aircraft.registration) },
    { label: "Category", value: categoryLabel(aircraft.category) },
    { label: "Altitude", value: unit(aircraft.altitudeMeters, "m", 0) },
    { label: "Ground speed", value: unit(aircraft.groundSpeedMetersPerSecond, "m/s", 1) },
    { label: "Vertical rate", value: unit(aircraft.verticalRateMetersPerSecond ?? null, "m/s", 1, true) },
    { label: "Heading", value: unit(aircraft.headingDegrees, "°", 0) },
    { label: "Latitude", value: coordinate(aircraft.latitudeDegrees, "N", "S") },
    { label: "Longitude", value: coordinate(aircraft.longitudeDegrees, "E", "W") },
    { label: "Lifecycle", value: lifecycleLabel(aircraft.lifecycle) },
  ];
}

function text(value: string | null) {
  return value?.trim() || "Unknown";
}

function unit(
  value: number | null,
  suffix: string,
  fractionDigits: number,
  signed = false,
) {
  if (value === null || !Number.isFinite(value)) return "Unknown";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(fractionDigits)} ${suffix}`;
}

function coordinate(value: number, positive: string, negative: string) {
  if (!Number.isFinite(value)) return "Unknown";
  return `${Math.abs(value).toFixed(5)}° ${value < 0 ? negative : positive}`;
}

function categoryLabel(category: AircraftCategory) {
  return category === "unknown"
    ? "Unknown"
    : category.charAt(0).toUpperCase() + category.slice(1);
}

function lifecycleLabel(lifecycle: Aircraft["lifecycle"]) {
  if (lifecycle === "FRESH") return "Fresh";
  if (lifecycle === "STALE") return "Stale";
  return "Unknown";
}
