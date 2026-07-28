import assert from "node:assert/strict";
import test from "node:test";
import { presentWorldExperienceStatus } from "../../map/presentation/worldExperienceStatus.ts";

test("live status stays compact and user-facing", () => {
  assert.deepEqual(presentWorldExperienceStatus("connected", 163, false), {
    label: "Live • 163 aircraft",
    tone: "live",
  });
  assert.deepEqual(presentWorldExperienceStatus("connected", 0, false), {
    label: "Live • No aircraft nearby",
    tone: "live",
  });
});

test("loading preserves context without exposing backend or tile details", () => {
  assert.deepEqual(presentWorldExperienceStatus("loading-region", 163, false), {
    label: "Refreshing • 163 aircraft",
    tone: "loading",
  });
  assert.deepEqual(presentWorldExperienceStatus("loading-region", 0, false), {
    label: "Loading live data",
    tone: "loading",
  });
});

test("delayed, inactive and replay states remain explicit", () => {
  assert.deepEqual(presentWorldExperienceStatus("reconnecting", 12, false), {
    label: "Live data delayed • 12 aircraft",
    tone: "delayed",
  });
  assert.equal(
    presentWorldExperienceStatus("invalid-viewport", 0, false).label,
    "Zoom in for live data",
  );
  assert.equal(
    presentWorldExperienceStatus("not-configured", 0, false).label,
    "Live unavailable",
  );
  assert.equal(
    presentWorldExperienceStatus("connecting", 0, false).label,
    "Connecting",
  );
  assert.deepEqual(presentWorldExperienceStatus("connected", 40, true), {
    label: "Replay • recording live",
    tone: "inactive",
  });
});
