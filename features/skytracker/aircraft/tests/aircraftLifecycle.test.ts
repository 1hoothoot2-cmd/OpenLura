import test from "node:test";
import assert from "node:assert/strict";
import { aircraftId, type Aircraft } from "../domain/aircraft.ts";
import {
  applyAircraftLifecycle,
  applyAircraftLifecycles,
  classifyAircraftLifecycle,
} from "../domain/aircraftLifecycle.ts";

const NOW = 1_800_000_000_000;
const AIRCRAFT: Aircraft = {
  id: aircraftId("abc123"),
  latitudeDegrees: 52,
  longitudeDegrees: 5,
  headingDegrees: 90,
  callsign: "DEV123",
  registration: null,
  altitudeMeters: 10_000,
  groundSpeedMetersPerSecond: 200,
  verticalRateMetersPerSecond: 0,
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: NOW,
};

test("lifecycle follows source position age deterministically", () => {
  assert.equal(classifyAircraftLifecycle(AIRCRAFT, NOW + 30_000), "LIVE");
  assert.equal(classifyAircraftLifecycle(AIRCRAFT, NOW + 90_000), "PREDICTED");
  assert.equal(classifyAircraftLifecycle(AIRCRAFT, NOW + 180_000), "STALE");
  assert.equal(classifyAircraftLifecycle(AIRCRAFT, NOW + 421_000), "LOST");
});

test("unchanged lifecycle ticks preserve the aircraft collection identity", () => {
  const source = [{ ...AIRCRAFT, lifecycle: "LIVE" as const }];
  assert.equal(applyAircraftLifecycles(source, NOW + 10_000), source);
  assert.notEqual(applyAircraftLifecycles(source, NOW + 90_000), source);
});

test("provider stale state cannot be promoted to live", () => {
  assert.equal(
    classifyAircraftLifecycle({ ...AIRCRAFT, lifecycle: "STALE" }, NOW),
    "STALE",
  );
});

test("applying lifecycle preserves identity and only copies on a transition", () => {
  const source = { ...AIRCRAFT, lifecycle: "LIVE" as const };
  const live = applyAircraftLifecycle(source, NOW);
  assert.equal(live, source);
  const predicted = applyAircraftLifecycle(live, NOW + 90_000);
  assert.equal(predicted.id, AIRCRAFT.id);
  assert.equal(predicted.lifecycle, "PREDICTED");
});
