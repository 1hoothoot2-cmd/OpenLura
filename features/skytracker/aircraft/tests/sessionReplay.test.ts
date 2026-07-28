import assert from "node:assert/strict";
import test from "node:test";
import type { Aircraft } from "../domain/aircraft.ts";
import { aircraftId } from "../domain/aircraft.ts";
import { updateFlightPhaseSessions } from "../domain/flightPhaseSession.ts";
import { ReplayClock } from "../motion/replayClock.ts";
import {
  enterReplayState,
  LIVE_REPLAY_STATE,
  pauseReplayState,
  playReplayState,
  seekReplayState,
} from "../../replay/domain/replayState.ts";
import {
  MAX_RECORDED_FRAMES,
  MAX_RECORDING_DURATION_MILLIS,
  recordedFrameToAircraft,
  replayFrameAt,
  SessionRecorder,
} from "../../replay/domain/sessionRecorder.ts";

const AIRCRAFT: Aircraft = {
  id: aircraftId("replay"),
  latitudeDegrees: 52,
  longitudeDegrees: 5,
  altitudeMeters: 8_000,
  headingDegrees: 90,
  groundSpeedMetersPerSecond: 200,
  verticalRateMetersPerSecond: 0,
  callsign: "RPLY01",
  registration: "PH-RPL",
  onGround: false,
  category: "passenger",
  lifecycle: "FRESH",
  positionTimestampEpochMillis: 1_000,
};

test("session recorder records snapshots and deduplicates identical records", () => {
  const recorder = new SessionRecorder();
  assert.equal(recorder.record(1_000, [AIRCRAFT]), true);
  assert.equal(recorder.record(1_000, [AIRCRAFT]), false);
  assert.equal(recorder.frameCount, 1);
  assert.equal(recorder.record(2_000, [AIRCRAFT]), true);
  assert.equal(recorder.frameCount, 2);
  assert.equal(recorder.durationMillis, 1_000);
});

test("ringbuffer bounds frame count and prunes records older than 30 minutes", () => {
  const recorder = new SessionRecorder();
  for (let index = 0; index < MAX_RECORDED_FRAMES + 10; index += 1) {
    recorder.record(index + 1, [{ ...AIRCRAFT, latitudeDegrees: 52 + index / 10_000 }]);
  }
  assert.equal(recorder.frameCount, MAX_RECORDED_FRAMES);

  recorder.record(MAX_RECORDING_DURATION_MILLIS + 10_000, [AIRCRAFT]);
  const frames = recorder.snapshot();
  assert.ok(
    frames.every(
      (frame) =>
        MAX_RECORDING_DURATION_MILLIS + 10_000 - frame.timestampEpochMillis <=
        MAX_RECORDING_DURATION_MILLIS,
    ),
  );
});

test("replay sampling selects begin, intermediate and final frames", () => {
  const recorder = new SessionRecorder();
  recorder.record(1_000, [AIRCRAFT]);
  recorder.record(2_000, [{ ...AIRCRAFT, longitudeDegrees: 6 }]);
  recorder.record(3_000, [{ ...AIRCRAFT, longitudeDegrees: 7 }]);
  const frames = recorder.snapshot();
  assert.equal(replayFrameAt(frames, 0)?.aircraft[0]?.longitudeDegrees, 5);
  assert.equal(replayFrameAt(frames, 1_500)?.aircraft[0]?.longitudeDegrees, 6);
  assert.equal(replayFrameAt(frames, 99_000)?.aircraft[0]?.longitudeDegrees, 7);
});

test("replay state supports play, pause, begin, seek and live", () => {
  const entered = enterReplayState(10_000);
  assert.deepEqual(entered, {
    mode: "replay",
    playing: false,
    positionMillis: 0,
    durationMillis: 10_000,
  });
  const playing = playReplayState(entered);
  assert.equal(playing.playing, true);
  const paused = pauseReplayState(playing, 4_000);
  assert.equal(paused.playing, false);
  assert.equal(paused.positionMillis, 4_000);
  assert.equal(seekReplayState(paused, 0).positionMillis, 0);
  assert.equal(seekReplayState(paused, 20_000).positionMillis, 10_000);
  assert.equal(LIVE_REPLAY_STATE.mode, "live");
});

test("ReplayClock seek preserves play and pause semantics", () => {
  let now = 100;
  const clock = new ReplayClock(() => now);
  clock.seek(2_000);
  assert.equal(clock.currentTime(), 2_000);
  clock.play();
  now = 350;
  assert.equal(clock.currentTime(), 2_250);
  clock.seek(500);
  now = 450;
  assert.equal(clock.currentTime(), 600);
  clock.pause();
  assert.equal(clock.currentTime(), 600);
});

test("recorded frames switch the motion source without changing identity metadata", () => {
  const recorder = new SessionRecorder();
  recorder.record(1_000, [AIRCRAFT]);
  recorder.record(2_000, [{ ...AIRCRAFT, longitudeDegrees: 8 }]);
  const frame = replayFrameAt(recorder.snapshot(), 1_000);
  assert.ok(frame);
  const replayAircraft = recordedFrameToAircraft(frame, [AIRCRAFT]);
  assert.equal(replayAircraft[0]?.longitudeDegrees, 8);
  assert.equal(replayAircraft[0]?.callsign, AIRCRAFT.callsign);
  assert.equal(replayAircraft[0]?.registration, AIRCRAFT.registration);
});

test("timeline can follow replay snapshots without stored provider phase fields", () => {
  const recorder = new SessionRecorder();
  recorder.record(1_000, [AIRCRAFT]);
  const frame = recorder.snapshot()[0];
  assert.ok(frame);
  const replayAircraft = recordedFrameToAircraft(frame, [AIRCRAFT]);
  const sessions = updateFlightPhaseSessions(new Map(), replayAircraft);
  assert.equal(sessions.get(AIRCRAFT.id)?.currentPhase, "UNKNOWN");
});
