import test from "node:test";
import assert from "node:assert/strict";
import { DEVELOPMENT_AIRCRAFT } from "../fixtures/developmentAircraft.ts";
import {
  applyMotionSample,
  createLiveMotionState,
  createMotionPlan,
  effectiveExtrapolationMillis,
  extrapolateAircraftPosition,
  interpolateHeadingDegrees,
  interpolateMotionPlan,
  MAXIMUM_EXTRAPOLATION_MILLIS,
  NORMAL_EXTRAPOLATION_MILLIS,
  sampleLiveMotionState,
  sampleRepeatingMotionPlan,
  type MotionPlan,
} from "../motion/aircraftMotion.ts";
import { ReplayClock } from "../motion/replayClock.ts";
import { AircraftMotionRuntime } from "../../map/infrastructure/aircraftMotionRuntime.ts";
import type { Aircraft } from "../domain/aircraft.ts";

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

test("live aircraft continues moving after the former four second boundary", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[1];
  const state = createLiveMotionState(
    aircraft,
    {
      latitudeDegrees: aircraft.latitudeDegrees,
      longitudeDegrees: aircraft.longitudeDegrees,
    },
    aircraft.headingDegrees,
    0,
    aircraft.positionTimestampEpochMillis,
  );

  const atFourSeconds = sampleLiveMotionState(state, 4_000);
  const atTenSeconds = sampleLiveMotionState(state, 10_000);
  assert.notDeepEqual(
    [atFourSeconds.latitudeDegrees, atFourSeconds.longitudeDegrees],
    [atTenSeconds.latitudeDegrees, atTenSeconds.longitudeDegrees],
  );
});

test("live extrapolation follows speed and cardinal heading", () => {
  const aircraft = {
    ...DEVELOPMENT_AIRCRAFT[0],
    headingDegrees: 90,
    groundSpeedMetersPerSecond: 200,
    onGround: false,
  };
  const projected = extrapolateAircraftPosition(aircraft, 30_000);
  assert.ok(projected.longitudeDegrees > aircraft.longitudeDegrees);
  assert.ok(
    Math.abs(projected.latitudeDegrees - aircraft.latitudeDegrees) < 0.001,
  );
});

test("on-ground, zero-speed and missing-heading aircraft remain stationary", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[0];
  const cases = [
    { ...aircraft, onGround: true },
    { ...aircraft, groundSpeedMetersPerSecond: 0 },
    { ...aircraft, headingDegrees: null },
  ];
  for (const candidate of cases) {
    assert.deepEqual(extrapolateAircraftPosition(candidate, 60_000), {
      latitudeDegrees: candidate.latitudeDegrees,
      longitudeDegrees: candidate.longitudeDegrees,
    });
  }
});

test("heading interpolation uses the shortest normalized turn", () => {
  assert.equal(interpolateHeadingDegrees(359, 1, 0.5), 0);
  assert.equal(interpolateHeadingDegrees(1, 359, 0.5), 0);
  assert.equal(interpolateHeadingDegrees(null, 270, 0.5), 270);
  assert.equal(interpolateHeadingDegrees(90, null, 0.5), 90);
});

test("new snapshots reconcile smoothly and cap large correction duration", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[0];
  const nearby = createLiveMotionState(
    aircraft,
    {
      latitudeDegrees: aircraft.latitudeDegrees - 0.01,
      longitudeDegrees: aircraft.longitudeDegrees,
    },
    aircraft.headingDegrees,
    0,
    aircraft.positionTimestampEpochMillis,
  );
  const large = createLiveMotionState(
    aircraft,
    { latitudeDegrees: 0, longitudeDegrees: 0 },
    aircraft.headingDegrees,
    0,
    aircraft.positionTimestampEpochMillis,
  );

  const start = sampleLiveMotionState(nearby, 0);
  const halfway = sampleLiveMotionState(
    nearby,
    nearby.correctionDurationMillis / 2,
  );
  assert.equal(start.latitudeDegrees, aircraft.latitudeDegrees - 0.01);
  assert.ok(halfway.latitudeDegrees > start.latitudeDegrees);
  assert.ok(nearby.correctionDurationMillis <= 8_000);
  assert.equal(large.correctionDurationMillis, 8_000);
});

test("freshness fades motion and stops extrapolation after four minutes", () => {
  assert.equal(effectiveExtrapolationMillis(0), 0);
  assert.equal(
    effectiveExtrapolationMillis(NORMAL_EXTRAPOLATION_MILLIS),
    NORMAL_EXTRAPOLATION_MILLIS,
  );
  assert.equal(
    effectiveExtrapolationMillis(MAXIMUM_EXTRAPOLATION_MILLIS),
    180_000,
  );
  assert.equal(
    effectiveExtrapolationMillis(MAXIMUM_EXTRAPOLATION_MILLIS + 60_000),
    180_000,
  );

  const aircraft = DEVELOPMENT_AIRCRAFT[1];
  const stopped = extrapolateAircraftPosition(
    aircraft,
    MAXIMUM_EXTRAPOLATION_MILLIS,
  );
  const later = extrapolateAircraftPosition(
    aircraft,
    MAXIMUM_EXTRAPOLATION_MILLIS + 60_000,
  );
  assert.deepEqual(later, stopped);
});

test("live motion remains deterministic, finite and geographically valid", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[2];
  const state = createLiveMotionState(
    aircraft,
    {
      latitudeDegrees: aircraft.latitudeDegrees,
      longitudeDegrees: aircraft.longitudeDegrees,
    },
    aircraft.headingDegrees,
    100,
    aircraft.positionTimestampEpochMillis,
  );
  const first = sampleLiveMotionState(state, 123_456);
  const second = sampleLiveMotionState(state, 123_456);
  assert.deepEqual(first, second);
  assert.ok(Number.isFinite(first.latitudeDegrees));
  assert.ok(Number.isFinite(first.longitudeDegrees));
  assert.ok(first.latitudeDegrees >= -90 && first.latitudeDegrees <= 90);
  assert.ok(first.longitudeDegrees >= -180 && first.longitudeDegrees <= 180);
});

test("motion runtime uses one RAF loop for multiple aircraft and cleans it up", () => {
  const harness = createRuntimeHarness(DEVELOPMENT_AIRCRAFT.slice(0, 3));
  harness.runtime.start();
  harness.runtime.start();
  assert.equal(harness.scheduledFrames.length, 1);

  harness.now = 5_000;
  harness.scheduledFrames.shift()?.(5_000);
  assert.equal(harness.frames.at(-1)?.length, 3);
  assert.equal(harness.scheduledFrames.length, 1);

  harness.runtime.dispose();
  assert.equal(harness.cancelledFrames.length, 1);
  assert.equal(harness.scheduledFrames.length, 1);
  harness.scheduledFrames.shift()?.(6_000);
  assert.equal(harness.scheduledFrames.length, 0);
});

test("hidden documents pause frames and resume one shared loop", () => {
  const harness = createRuntimeHarness([DEVELOPMENT_AIRCRAFT[1]]);
  harness.runtime.start();
  const initialFrameCount = harness.frames.length;

  harness.document.hidden = true;
  harness.visibilityListener?.();
  assert.equal(harness.cancelledFrames.length, 1);

  harness.now = 20_000;
  harness.document.hidden = false;
  harness.visibilityListener?.();
  assert.equal(harness.scheduledFrames.length, 2);
  harness.scheduledFrames.at(-1)?.(20_000);
  harness.now = 20_100;
  harness.scheduledFrames.at(-1)?.(20_100);
  assert.equal(harness.frames.length, initialFrameCount + 1);
  assert.equal(harness.scheduledFrames.length, 4);
  harness.runtime.dispose();
});

test("replay mode does not use live extrapolation", () => {
  const aircraft = DEVELOPMENT_AIRCRAFT[1];
  const harness = createRuntimeHarness([aircraft], true);
  harness.runtime.start();
  harness.runtime.setAircraftSnapshot([aircraft], true);
  harness.now = 60_000;
  harness.scheduledFrames.shift()?.(60_000);
  const replayed = harness.frames.at(-1)?.[0];
  assert.equal(replayed?.latitudeDegrees, aircraft.latitudeDegrees);
  assert.equal(replayed?.longitudeDegrees, aircraft.longitudeDegrees);
  harness.runtime.dispose();
});

function createRuntimeHarness(
  aircraft: readonly Aircraft[],
  replayMode = false,
) {
  let now = 0;
  const scheduledFrames: FrameRequestCallback[] = [];
  const cancelledFrames: number[] = [];
  const frames: (readonly Aircraft[])[] = [];
  let visibilityListener: (() => void) | null = null;
  const documentState = {
    hidden: false,
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      if (type === "visibilitychange") {
        visibilityListener = listener as () => void;
      }
    },
    removeEventListener() {
      visibilityListener = null;
    },
  };
  const runtime = new AircraftMotionRuntime({
    aircraft,
    sourceWriter: {
      write: () => true,
    } as never,
    selectedAircraftId: null,
    replayMode,
    epochNow: () =>
      (aircraft[0]?.positionTimestampEpochMillis ?? 0) + now,
    window: {
      performance: { now: () => now },
      requestAnimationFrame(callback: FrameRequestCallback) {
        scheduledFrames.push(callback);
        return scheduledFrames.length;
      },
      cancelAnimationFrame(handle: number) {
        cancelledFrames.push(handle);
      },
    } as never,
    document: documentState as never,
    reducedMotionQuery: {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    } as never,
    onFrame: (nextAircraft) => frames.push(nextAircraft),
  });
  return {
    runtime,
    scheduledFrames,
    cancelledFrames,
    frames,
    document: documentState,
    get visibilityListener() {
      return visibilityListener;
    },
    get now() {
      return now;
    },
    set now(value: number) {
      now = value;
    },
  };
}
