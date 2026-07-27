import assert from "node:assert/strict";
import test from "node:test";
import type { Aircraft } from "../domain/aircraft.ts";
import { aircraftId } from "../domain/aircraft.ts";
import { determineFlightPhase } from "../domain/flightPhase.ts";
import { createFlightTimelineModel } from "../presentation/flightTimelineModel.ts";

const BASE: Aircraft = {
  id: aircraftId("timeline"),
  latitudeDegrees: 52,
  longitudeDegrees: 5,
  headingDegrees: 90,
  callsign: "TIME01",
  registration: null,
  altitudeMeters: 9_000,
  groundSpeedMetersPerSecond: 220,
  verticalRateMetersPerSecond: 0,
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: Date.UTC(2026, 6, 27, 18, 30),
};

test("flight phase deterministically identifies ground and taxi", () => {
  assert.equal(
    determineFlightPhase({ ...BASE, onGround: true, groundSpeedMetersPerSecond: 0 }),
    "GROUND",
  );
  assert.equal(
    determineFlightPhase({ ...BASE, onGround: true, groundSpeedMetersPerSecond: 12 }),
    "TAXI",
  );
});

test("flight phase identifies take-off, climb, cruise, descent and landing", () => {
  assert.equal(
    determineFlightPhase({ ...BASE, altitudeMeters: 400, verticalRateMetersPerSecond: 4 }),
    "TAKE_OFF",
  );
  assert.equal(
    determineFlightPhase({ ...BASE, altitudeMeters: 4_000, verticalRateMetersPerSecond: 4 }),
    "CLIMB",
  );
  assert.equal(determineFlightPhase(BASE), "CRUISE");
  assert.equal(
    determineFlightPhase({ ...BASE, altitudeMeters: 4_000, verticalRateMetersPerSecond: -4 }),
    "DESCENT",
  );
  assert.equal(
    determineFlightPhase({ ...BASE, altitudeMeters: 400, verticalRateMetersPerSecond: -4 }),
    "LANDING",
  );
});

test("missing or insufficient airborne values resolve to unknown", () => {
  assert.equal(determineFlightPhase({ ...BASE, altitudeMeters: null }), "UNKNOWN");
  assert.equal(
    determineFlightPhase({ ...BASE, verticalRateMetersPerSecond: null }),
    "UNKNOWN",
  );
  assert.equal(
    determineFlightPhase({ ...BASE, altitudeMeters: 1_500, groundSpeedMetersPerSecond: 20 }),
    "UNKNOWN",
  );
});

test("timeline rendering exposes detected, current and unavailable states", () => {
  const timeline = createFlightTimelineModel(BASE);
  assert.equal(timeline.currentPhaseLabel, "Cruise");
  assert.equal(timeline.steps.length, 10);
  assert.deepEqual(
    timeline.steps.map((step) => step.label),
    [
      "Flight detected",
      "Pushback",
      "Taxi",
      "Take-off",
      "Climb",
      "Cruise",
      "Descent",
      "Landing",
      "Taxi in",
      "Gate",
    ],
  );
  assert.equal(timeline.steps[0]?.state, "detected");
  assert.equal(timeline.steps[5]?.state, "current");
  assert.equal(timeline.steps[1]?.detail, "Not available");
});

test("timeline changes deterministically with a new polling snapshot", () => {
  const detectedAt = BASE.positionTimestampEpochMillis;
  const cruise = createFlightTimelineModel(BASE, detectedAt);
  const descent = createFlightTimelineModel({
    ...BASE,
    verticalRateMetersPerSecond: -3,
    positionTimestampEpochMillis: BASE.positionTimestampEpochMillis + 5_000,
  }, detectedAt);
  assert.equal(cruise.phase, "CRUISE");
  assert.equal(descent.phase, "DESCENT");
  assert.equal(descent.detectedAtLabel, cruise.detectedAtLabel);
  assert.equal(
    descent.steps.find((step) => step.state === "current")?.label,
    "Descent",
  );
  assert.deepEqual(createFlightTimelineModel(BASE, detectedAt), cruise);
});
