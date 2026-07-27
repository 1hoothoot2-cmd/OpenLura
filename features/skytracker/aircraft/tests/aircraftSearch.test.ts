import test from "node:test";
import assert from "node:assert/strict";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import { searchAircraft } from "../domain/aircraftSearch.ts";

const AIRCRAFT: readonly Aircraft[] = [
  aircraft("abc123", "SKY552", "EI-LVE"),
  aircraft("def456", "SKY552A", "PH-VSY"),
  aircraft("aaa552", "DEV180", null),
  aircraft("789abc", null, "N789AB"),
];

test("search matches callsign, registration and aircraft ID case-insensitively", () => {
  assert.deepEqual(searchAircraft(AIRCRAFT, "sky552").map(id), ["abc123", "def456"]);
  assert.deepEqual(searchAircraft(AIRCRAFT, " ph-vs ").map(id), ["def456"]);
  assert.deepEqual(searchAircraft(AIRCRAFT, "AAA5").map(id), ["aaa552"]);
});

test("search ranks exact before prefix before contains deterministically", () => {
  assert.deepEqual(searchAircraft(AIRCRAFT, "552").map(id), [
    "abc123",
    "def456",
    "aaa552",
  ]);
  assert.equal(searchAircraft(AIRCRAFT, "sky552")[0]?.matchType, "exact");
  assert.equal(searchAircraft(AIRCRAFT, "sky552")[1]?.matchType, "prefix");
});

test("search safely handles missing metadata, empty queries and result limits", () => {
  assert.deepEqual(searchAircraft(AIRCRAFT, "n789").map(id), ["789abc"]);
  assert.deepEqual(searchAircraft(AIRCRAFT, "  "), []);
  assert.deepEqual(searchAircraft(AIRCRAFT, "sky", 1).map(id), ["abc123"]);
});

test("search results are derived only from the supplied current snapshot", () => {
  const before = searchAircraft(AIRCRAFT, "sky552").map(id);
  const after = searchAircraft(AIRCRAFT.slice(1), "sky552").map(id);
  assert.deepEqual(before, ["abc123", "def456"]);
  assert.deepEqual(after, ["def456"]);
});

function aircraft(
  id: string,
  callsign: string | null,
  registration: string | null,
): Aircraft {
  return {
    id: aircraftId(id),
    latitudeDegrees: 52,
    longitudeDegrees: 5,
    headingDegrees: 90,
    callsign,
    registration,
    altitudeMeters: 9_000,
    groundSpeedMetersPerSecond: 200,
    verticalRateMetersPerSecond: 0,
    onGround: false,
    category: "passenger",
    lifecycle: "FRESH",
    positionTimestampEpochMillis: 1_700_000_000_000,
  };
}

function id(result: ReturnType<typeof searchAircraft>[number]) {
  return result.aircraft.id;
}
