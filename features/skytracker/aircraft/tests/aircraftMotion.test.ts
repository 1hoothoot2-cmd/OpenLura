import test from "node:test";
import assert from "node:assert/strict";
import { DEVELOPMENT_AIRCRAFT } from "../fixtures/developmentAircraft.ts";
import {
  applyMotionSample,
  createMotionPlan,
  interpolateMotionPlan,
  sampleRepeatingMotionPlan,
  type MotionPlan,
} from "../motion/aircraftMotion.ts";
import { ReplayClock } from "../motion/replayClock.ts";

const LINEAR_PLAN: MotionPlan = {
  startPosition: {
    latitudeDegrees: 50,
    longitudeDegrees: 4,
  },
  targetPosition: {
    latitudeDegrees: 52,
    longitudeDegrees: 8,
  },
  headingDegrees: 45,
  speedMetersPerSecond: 200,
  startTimeMillis: 1_000,
  durationMillis: 4_000,
};

test("motion interpolation returns exact 0, 50 and 100 percent positions", () => {
  assert.deepEqual(interpolateMotionPlan(LINEAR_PLAN, 1_000), {
    latitudeDegrees: 50,
    longitudeDegrees: 4,
  });
  assert.deepEqual(interpolateMotionPlan(LINEAR_PLAN, 3_000), {
    latitudeDegrees: 51,
    longitudeDegrees: 6,
  });
  assert.deepEqual(interpolateMotionPlan(LINEAR_PLAN, 5_000), {
    latitudeDegrees: 52,
    longitudeDegrees: 8,
  });
});

test("motion interpolation clamps times outside its plan", () => {
  assert.deepEqual(
    interpolateMotionPlan(LINEAR_PLAN, -1),
    LINEAR_PLAN.startPosition,
  );
  assert.deepEqual(
    interpolateMotionPlan(LINEAR_PLAN, 10_000),
    LINEAR_PLAN.targetPosition,
  );
});

test("cardinal headings move in the expected geographic direction", () => {
  const north = createMotionPlan(DEVELOPMENT_AIRCRAFT[0], 0, 4_000);
  const east = createMotionPlan(DEVELOPMENT_AIRCRAFT[1], 0, 4_000);
  const south = createMotionPlan(DEVELOPMENT_AIRCRAFT[2], 0, 4_000);
  const west = createMotionPlan(DEVELOPMENT_AIRCRAFT[3], 0, 4_000);

  assert.ok(
    north.targetPosition.latitudeDegrees >
      north.startPosition.latitudeDegrees,
  );
  assert.ok(
    east.targetPosition.longitudeDegrees > east.startPosition.longitudeDegrees,
  );
  assert.ok(
    south.targetPosition.latitudeDegrees <
      south.startPosition.latitudeDegrees,
  );
  assert.ok(
    west.targetPosition.longitudeDegrees < west.startPosition.longitudeDegrees,
  );
});

test("repeating plans remain continuous across deterministic target changes", () => {
  const plan = createMotionPlan(DEVELOPMENT_AIRCRAFT[0], 0, 4_000);
  const beforeBoundary = sampleRepeatingMotionPlan(plan, 3_999.999);
  const atBoundary = sampleRepeatingMotionPlan(plan, 4_000);

  assert.ok(
    Math.abs(beforeBoundary.latitudeDegrees - atBoundary.latitudeDegrees) <
      0.000001,
  );
  assert.ok(
    Math.abs(beforeBoundary.longitudeDegrees - atBoundary.longitudeDegrees) <
      0.000001,
  );
});

test("motion sampling is deterministic and preserves aircraft identity", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[4];
  const plan = createMotionPlan(aircraft);
  const first = applyMotionSample(aircraft, plan, 12_345);
  const second = applyMotionSample(aircraft, plan, 12_345);

  assert.deepEqual(first, second);
  assert.equal(first.id, aircraft.id);
  assert.equal(first.headingDegrees, aircraft.headingDegrees);
  assert.notEqual(first.latitudeDegrees, aircraft.latitudeDegrees);
});

test("ReplayClock plays, pauses and resumes without counting paused time", () => {
  let now = 100;
  const clock = new ReplayClock(() => now);

  assert.equal(clock.currentTime(), 0);
  assert.equal(clock.isPlaying, false);

  clock.play();
  now = 350;
  assert.equal(clock.currentTime(), 250);

  clock.pause();
  now = 900;
  assert.equal(clock.currentTime(), 250);
  assert.equal(clock.isPlaying, false);

  clock.play();
  now = 1_050;
  assert.equal(clock.currentTime(), 400);
  assert.equal(clock.isPlaying, true);
});

test("ReplayClock play and pause operations are idempotent", () => {
  let now = 10;
  const clock = new ReplayClock(() => now);

  clock.play();
  clock.play();
  now = 60;
  clock.pause();
  clock.pause();

  assert.equal(clock.currentTime(), 50);
});
