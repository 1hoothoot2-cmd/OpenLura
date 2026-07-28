import assert from "node:assert/strict";
import test from "node:test";
import type { Aircraft } from "../domain/aircraft.ts";
import { aircraftId } from "../domain/aircraft.ts";
import { determineFlightPhase } from "../domain/flightPhase.ts";
import {
  updateFlightPhaseSessions,
  type FlightPhaseSessions,
} from "../domain/flightPhaseSession.ts";
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

function withPhase(
  phase: "CLIMB" | "CRUISE" | "DESCENT",
  aircraft = BASE,
): Aircraft {
  const verticalRateMetersPerSecond =
    phase === "CLIMB" ? 3 : phase === "DESCENT" ? -3 : 0;
  return {
    ...aircraft,
    altitudeMeters: phase === "CRUISE" ? 9_000 : 6_000,
    verticalRateMetersPerSecond,
    positionTimestampEpochMillis:
      aircraft.positionTimestampEpochMillis + 5_000,
  };
}

function update(
  sessions: FlightPhaseSessions,
  aircraft: readonly Aircraft[],
) {
  return updateFlightPhaseSessions(sessions, aircraft);
}

test("flight phase deterministically identifies ground and taxi", () => {
  assert.equal(
    determineFlightPhase({
      ...BASE,
      onGround: true,
      groundSpeedMetersPerSecond: 0,
    }),
    "GROUND",
  );
  assert.equal(
    determineFlightPhase({
      ...BASE,
      onGround: true,
      groundSpeedMetersPerSecond: 12,
    }),
    "TAXI",
  );
});

test("flight phase identifies take-off, climb, cruise, descent and landing", () => {
  assert.equal(
    determineFlightPhase({
      ...BASE,
      altitudeMeters: 400,
      verticalRateMetersPerSecond: 4,
    }),
    "TAKE_OFF",
  );
  assert.equal(determineFlightPhase(withPhase("CLIMB")), "CLIMB");
  assert.equal(determineFlightPhase(BASE), "CRUISE");
  assert.equal(determineFlightPhase(withPhase("DESCENT")), "DESCENT");
  assert.equal(
    determineFlightPhase({
      ...BASE,
      altitudeMeters: 400,
      verticalRateMetersPerSecond: -4,
    }),
    "LANDING",
  );
});

test("missing or insufficient airborne values resolve to unknown", () => {
  assert.equal(determineFlightPhase({ ...BASE, altitudeMeters: null }), "UNKNOWN");
  assert.equal(
    determineFlightPhase({ ...BASE, verticalRateMetersPerSecond: null }),
    "UNKNOWN",
  );
});

test("detection during cruise leaves earlier phases unknown and later phases upcoming", () => {
  const sessions = update(new Map(), [BASE]);
  const session = sessions.get(BASE.id);
  assert.ok(session);
  const timeline = createFlightTimelineModel(BASE, session);
  assert.equal(timeline.currentPhaseLabel, "Cruise");
  assert.equal(status(timeline, "Flight detected"), "CONFIRMED");
  assert.equal(status(timeline, "Climb"), "UNKNOWN");
  assert.equal(status(timeline, "Cruise"), "CURRENT");
  assert.equal(status(timeline, "Descent"), "UPCOMING");
  assert.equal(status(timeline, "Gate"), "UPCOMING");
});

test("observed climb and cruise become confirmed after real transitions", () => {
  let sessions = update(new Map(), [withPhase("CLIMB")]);
  sessions = update(sessions, [withPhase("CRUISE")]);
  let session = sessions.get(BASE.id);
  assert.ok(session);
  let timeline = createFlightTimelineModel(BASE, session);
  assert.equal(status(timeline, "Climb"), "CONFIRMED");
  assert.equal(status(timeline, "Cruise"), "CURRENT");

  sessions = update(sessions, [withPhase("DESCENT")]);
  session = sessions.get(BASE.id);
  assert.ok(session);
  timeline = createFlightTimelineModel(withPhase("DESCENT"), session);
  assert.equal(status(timeline, "Climb"), "CONFIRMED");
  assert.equal(status(timeline, "Cruise"), "CONFIRMED");
  assert.equal(status(timeline, "Descent"), "CURRENT");
});

test("temporary return to climb retains confirmed observations", () => {
  let sessions = update(new Map(), [withPhase("CLIMB")]);
  sessions = update(sessions, [withPhase("CRUISE")]);
  sessions = update(sessions, [withPhase("DESCENT")]);
  sessions = update(sessions, [withPhase("CLIMB")]);
  const session = sessions.get(BASE.id);
  assert.ok(session);
  assert.deepEqual(
    [...session.confirmedStages].sort(),
    ["CLIMB", "CRUISE", "DESCENT"].sort(),
  );
  const timeline = createFlightTimelineModel(withPhase("CLIMB"), session);
  assert.equal(status(timeline, "Climb"), "CURRENT");
  assert.equal(status(timeline, "Cruise"), "CONFIRMED");
  assert.equal(status(timeline, "Descent"), "CONFIRMED");
});

test("polling without a phase change preserves the exact session object", () => {
  const sessions = update(new Map(), [BASE]);
  const repeated = update(sessions, [
    { ...BASE, positionTimestampEpochMillis: BASE.positionTimestampEpochMillis + 5_000 },
  ]);
  assert.equal(repeated, sessions);
});

test("aircraft IDs keep separate history and disappeared aircraft are cleaned up", () => {
  const second = { ...withPhase("CLIMB"), id: aircraftId("second") };
  let sessions = update(new Map(), [BASE, second]);
  sessions = update(sessions, [withPhase("DESCENT"), second]);
  assert.equal(sessions.size, 2);
  assert.equal(sessions.get(BASE.id)?.confirmedStages.has("CRUISE"), true);
  assert.equal(sessions.get(second.id)?.confirmedStages.size, 0);

  sessions = update(sessions, [second]);
  assert.equal(sessions.has(BASE.id), false);
  assert.equal(sessions.size, 1);
});

test("session state is memory-only and every timeline has exactly one accessible current status", () => {
  const sessions = update(new Map(), [BASE]);
  const session = sessions.get(BASE.id);
  assert.ok(session);
  const timeline = createFlightTimelineModel(BASE, session);
  assert.equal(
    timeline.steps.filter((step) => step.status === "CURRENT").length,
    1,
  );
  assert.deepEqual(
    new Set(timeline.steps.map((step) => step.detail)),
    new Set([
      `Confirmed · ${timeline.detectedAtLabel}`,
      "History unavailable",
      "Current phase",
      "Upcoming",
    ]),
  );
});

function status(
  timeline: ReturnType<typeof createFlightTimelineModel>,
  label: string,
) {
  return timeline.steps.find((step) => step.label === label)?.status;
}
