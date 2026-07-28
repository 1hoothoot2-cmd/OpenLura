import type {
  Aircraft,
  AircraftCategory,
} from "./aircraft.ts";

export type AircraftTypeFilter = "passenger" | "cargo" | "unknown";
export type AircraftLifecycleFilter = "LIVE" | "PREDICTED" | "STALE" | "LOST";
export type AircraftAltitudeFilter = "on-ground" | "low" | "medium" | "high";
export type AircraftSpeedFilter = "stationary" | "slow" | "cruise";

export type AircraftFilterState = Readonly<{
  types: readonly AircraftTypeFilter[];
  lifecycles: readonly AircraftLifecycleFilter[];
  altitudes: readonly AircraftAltitudeFilter[];
  speeds: readonly AircraftSpeedFilter[];
}>;

export type AircraftFilterGroup = keyof AircraftFilterState;
export type AircraftFilterValue =
  | AircraftTypeFilter
  | AircraftLifecycleFilter
  | AircraftAltitudeFilter
  | AircraftSpeedFilter;

export const DEFAULT_AIRCRAFT_FILTERS: AircraftFilterState = {
  types: [],
  lifecycles: [],
  altitudes: [],
  speeds: [],
};

export const LOW_ALTITUDE_LIMIT_METERS = 3_000;
export const HIGH_ALTITUDE_LIMIT_METERS = 8_000;
export const STATIONARY_SPEED_LIMIT_METERS_PER_SECOND = 1;
export const CRUISE_SPEED_LIMIT_METERS_PER_SECOND = 150;

export function filterAircraft(
  aircraft: readonly Aircraft[],
  filters: AircraftFilterState,
): readonly Aircraft[] {
  return aircraft.filter((item) => matchesAircraftFilters(item, filters));
}

export function matchesAircraftFilters(
  aircraft: Aircraft,
  filters: AircraftFilterState,
): boolean {
  return (
    matchesGroup(filters.types, aircraft.category, matchesType) &&
    matchesGroup(
      filters.lifecycles,
      aircraft.lifecycle === "FRESH" ? "LIVE" : (aircraft.lifecycle ?? "LIVE"),
      (filter, lifecycle) => filter === lifecycle,
    ) &&
    matchesGroup(filters.altitudes, aircraft, matchesAltitude) &&
    matchesGroup(filters.speeds, aircraft, matchesSpeed)
  );
}

export function toggleAircraftFilter(
  filters: AircraftFilterState,
  group: AircraftFilterGroup,
  value: AircraftFilterValue,
): AircraftFilterState {
  const values = filters[group] as readonly AircraftFilterValue[];
  const nextValues = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
  return { ...filters, [group]: nextValues };
}

export function countActiveAircraftFilters(filters: AircraftFilterState) {
  return (
    filters.types.length +
    filters.lifecycles.length +
    filters.altitudes.length +
    filters.speeds.length
  );
}

export function isAircraftFilterActive(
  filters: AircraftFilterState,
  group: AircraftFilterGroup,
  value: AircraftFilterValue,
) {
  return (filters[group] as readonly AircraftFilterValue[]).includes(value);
}

function matchesGroup<Filter, Value>(
  filters: readonly Filter[],
  value: Value,
  predicate: (filter: Filter, value: Value) => boolean,
) {
  return filters.length === 0 || filters.some((filter) => predicate(filter, value));
}

function matchesType(
  filter: AircraftTypeFilter,
  category: AircraftCategory,
) {
  return filter === category;
}

function matchesAltitude(
  filter: AircraftAltitudeFilter,
  aircraft: Aircraft,
) {
  if (filter === "on-ground") return aircraft.onGround;
  if (aircraft.onGround || aircraft.altitudeMeters === null) return false;
  if (filter === "low") {
    return aircraft.altitudeMeters < LOW_ALTITUDE_LIMIT_METERS;
  }
  if (filter === "medium") {
    return (
      aircraft.altitudeMeters >= LOW_ALTITUDE_LIMIT_METERS &&
      aircraft.altitudeMeters <= HIGH_ALTITUDE_LIMIT_METERS
    );
  }
  return aircraft.altitudeMeters > HIGH_ALTITUDE_LIMIT_METERS;
}

function matchesSpeed(filter: AircraftSpeedFilter, aircraft: Aircraft) {
  const speed = aircraft.groundSpeedMetersPerSecond;
  if (speed === null) return false;
  if (filter === "stationary") {
    return speed < STATIONARY_SPEED_LIMIT_METERS_PER_SECOND;
  }
  if (filter === "slow") {
    return (
      speed >= STATIONARY_SPEED_LIMIT_METERS_PER_SECOND &&
      speed < CRUISE_SPEED_LIMIT_METERS_PER_SECOND
    );
  }
  return speed >= CRUISE_SPEED_LIMIT_METERS_PER_SECOND;
}
