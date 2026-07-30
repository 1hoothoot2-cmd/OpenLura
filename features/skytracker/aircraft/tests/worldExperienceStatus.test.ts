import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
test("the local test label is explicit and production-gated", async () => {
  const source = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT === "local-test"/);
  assert.match(source, /Local \/ Test Data/);
  assert.match(source, /Fixture test data/);
  assert.match(source, /local fixture aircraft/);
  assert.doesNotMatch(source, /Staging environment/);
});

test("the mobile live-map header keeps Replay and Account compact and accessible", async () => {
  const mapSource = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  const accountSource = await readFile(
    new URL(
      "../../personal-platform/presentation/SkyTrackerAccountControl.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(mapSource, /hidden text-sm font-semibold[^"]*sm:inline/);
  assert.match(mapSource, /flex items-center gap-1 sm:gap-2\.5/);
  assert.match(mapSource, /h-11 w-11 shrink-0[^"]*sm:w-auto/);
  assert.match(mapSource, /aria-label=\{[\s\S]*Open session replay/);
  assert.match(accountSource, /aria-label=\{`SkyTracker account: \$\{label\}`\}/);
  assert.match(accountSource, /h-11 w-11 items-center[^"]*sm:w-auto/);
  assert.match(accountSource, /<span className="hidden sm:inline">\{label\}<\/span>/);
});
