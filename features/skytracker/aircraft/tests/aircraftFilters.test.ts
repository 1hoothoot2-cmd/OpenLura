import test from "node:test";
import assert from "node:assert/strict";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import {
  countActiveAircraftFilters,
  DEFAULT_AIRCRAFT_FILTERS,
  filterAircraft,
  matchesAircraftFilters,
  toggleAircraftFilter,
  type AircraftFilterState,
} from "../domain/aircraftFilters.ts";

const AIRCRAFT: readonly Aircraft[] = [
  aircraft("passenger-low", "passenger", "FRESH", 2_999, 120, false),
  aircraft("cargo-medium", "cargo", "STALE", 3_000, 149.9, false),
  aircraft("unknown-high", "unknown", "FRESH", 8_001, 150, false),
  aircraft("ground", "cargo", "FRESH", 0, 0, true),
];

test("individual aircraft type, lifecycle, altitude and speed filters work", () => {
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, types: ["cargo"] }), [
    "cargo-medium",
    "ground",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, lifecycles: ["STALE"] }), [
    "cargo-medium",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, altitudes: ["low"] }), [
    "passenger-low",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, altitudes: ["medium"] }), [
    "cargo-medium",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, altitudes: ["high"] }), [
    "unknown-high",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, altitudes: ["on-ground"] }), [
    "ground",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, speeds: ["stationary"] }), [
    "ground",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, speeds: ["slow"] }), [
    "passenger-low",
    "cargo-medium",
  ]);
  assert.deepEqual(ids({ ...DEFAULT_AIRCRAFT_FILTERS, speeds: ["cruise"] }), [
    "unknown-high",
  ]);
});

test("choices combine with OR inside groups and AND across groups", () => {
  assert.deepEqual(
    ids({
      ...DEFAULT_AIRCRAFT_FILTERS,
      types: ["passenger", "cargo"],
      lifecycles: ["LIVE"],
      speeds: ["stationary", "slow"],
    }),
    ["passenger-low", "ground"],
  );
});

test("toggle and reset are immutable and deterministic", () => {
  const active = toggleAircraftFilter(DEFAULT_AIRCRAFT_FILTERS, "types", "cargo");
  assert.deepEqual(active.types, ["cargo"]);
  assert.equal(countActiveAircraftFilters(active), 1);
  assert.deepEqual(
    toggleAircraftFilter(active, "types", "cargo"),
    DEFAULT_AIRCRAFT_FILTERS,
  );
  assert.deepEqual(filterAircraft(AIRCRAFT, active), filterAircraft(AIRCRAFT, active));
});

test("selection remains domain-owned when its aircraft is hidden", () => {
  const selected = AIRCRAFT[0];
  const filters = { ...DEFAULT_AIRCRAFT_FILTERS, types: ["cargo"] } as const;
  assert.equal(matchesAircraftFilters(selected, filters), false);
  assert.equal(AIRCRAFT.includes(selected), true);
});

test("new and disappeared snapshot aircraft are processed without retained state", () => {
  const filters = { ...DEFAULT_AIRCRAFT_FILTERS, lifecycles: ["LIVE"] } as const;
  assert.deepEqual(filterAircraft(AIRCRAFT, filters).map((item) => item.id), [
    "passenger-low",
    "unknown-high",
    "ground",
  ]);
  assert.deepEqual(filterAircraft([AIRCRAFT[1]], filters), []);
  assert.deepEqual(
    filterAircraft([...AIRCRAFT, aircraft("new", "cargo", "FRESH", 5_000, 170, false)], filters)
      .map((item) => item.id),
    ["passenger-low", "unknown-high", "ground", "new"],
  );
});

test("filtering is pure and contains no backend or motion side effect", () => {
  const before = structuredClone(AIRCRAFT);
  filterAircraft(AIRCRAFT, {
    types: ["unknown"],
    lifecycles: ["LIVE"],
    altitudes: ["high"],
    speeds: ["cruise"],
  });
  assert.deepEqual(AIRCRAFT, before);
});

function ids(filters: AircraftFilterState) {
  return filterAircraft(AIRCRAFT, filters).map((item) => item.id);
}

function aircraft(
  id: string,
  category: Aircraft["category"],
  lifecycle: NonNullable<Aircraft["lifecycle"]>,
  altitudeMeters: number,
  groundSpeedMetersPerSecond: number,
  onGround: boolean,
): Aircraft {
  return {
    id: aircraftId(id),
    latitudeDegrees: 52,
    longitudeDegrees: 5,
    headingDegrees: 90,
    callsign: id,
    registration: null,
    altitudeMeters,
    groundSpeedMetersPerSecond,
    verticalRateMetersPerSecond: 0,
    onGround,
    category,
    lifecycle,
    positionTimestampEpochMillis: 1_700_000_000_000,
  };
}
