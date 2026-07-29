import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  getLocalTestScenario,
  isLocalTestEnvironment,
  resetLocalTestScenario,
  setLocalTestScenario,
} from "../../local-test/localTestEnvironment.ts";
import { LocalSkyGuideProvider } from "../../local-test/localSkyGuideProvider.ts";
import { createLocalHistoricalTrackFixture } from "../../local-test/localHistoricalTrackFixture.ts";

const CONTEXT = {
  selectedAircraft: null,
  map: null,
  flightHistory: "unavailable",
} as const;

test("local test mode requires every non-production gate", () => {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.SKYTRACKER_LOCAL_TEST_MODE,
    presentation: process.env.NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT,
    host: process.env.SKYTRACKER_LOCAL_TEST_HOST,
    vercel: process.env.VERCEL,
  };
  try {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.SKYTRACKER_LOCAL_TEST_MODE = "enabled";
    process.env.NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT = "local-test";
    process.env.SKYTRACKER_LOCAL_TEST_HOST = "127.0.0.1";
    assert.equal(isLocalTestEnvironment(), true);
    process.env.VERCEL = "1";
    assert.equal(isLocalTestEnvironment(), false);
    assert.throws(() => getLocalTestScenario(), /disabled/);
  } finally {
    restore("NODE_ENV", original.nodeEnv);
    restore("SKYTRACKER_LOCAL_TEST_MODE", original.mode);
    restore("NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT", original.presentation);
    restore("SKYTRACKER_LOCAL_TEST_HOST", original.host);
    restore("VERCEL", original.vercel);
  }
});

test("local scenarios are deterministic, bounded and resettable", () => {
  withLocalTestMode(() => {
    resetLocalTestScenario();
    assert.equal(getLocalTestScenario(), "normal");
    assert.equal(setLocalTestScenario("stale-cache"), "stale-cache");
    assert.equal(getLocalTestScenario(), "stale-cache");
    assert.throws(() => setLocalTestScenario("production"), /Unsupported/);
    resetLocalTestScenario();
    assert.equal(getLocalTestScenario(), "normal");
  });
});

test("local SkyGuide provides airport and weather fixtures without web search", async () => {
  const provider = new LocalSkyGuideProvider();
  const scope = await provider.classifyScope("What is the METAR at EHAM?", CONTEXT);
  assert.equal(scope.accepted, true);
  assert.deepEqual(scope.toolPlan.tools, ["aviation-weather"]);
  assert.equal(scope.toolPlan.useWebSearch, false);
  const answer = await provider.answer({
    query: "What is the METAR at EHAM?",
    context: CONTEXT,
    audienceMode: "beginner",
    toolPlan: scope.toolPlan,
    monitoringIntent: {
      recognized: false,
      kind: null,
      confidence: "none",
      executionAvailable: false,
    },
    responseLanguage: "en",
  });
  assert.equal(answer.status, "cached");
  assert.equal(answer.sources?.[0]?.dataType, "weather");
  assert.match(answer.answer, /Local test weather/);
  assert.equal(
    (await provider.classifyScope("Give me a football recipe", CONTEXT)).accepted,
    false,
  );
});

test("local history covers both present and unavailable fixture states", () => {
  const present = createLocalHistoricalTrackFixture("406A3D", 1_700_000_180);
  assert.equal(present?.flight.flightNumber, "SKY553");
  assert.equal(present?.track.points.length, 3);
  assert.deepEqual(present?.track.points.at(-1), {
    latitude: 50.93,
    longitude: 3.62,
    observedAtEpochSeconds: 1_700_000_180,
  });
  assert.equal(
    createLocalHistoricalTrackFixture("484516", 1_700_000_180),
    null,
  );
});

test("local-only API routes and visual labels remain hard gated", async () => {
  const scenarioRoute = await readFile(
    new URL("../../../../app/api/skytracker/local-test/scenario/route.ts", import.meta.url),
    "utf8",
  );
  const aircraftRoute = await readFile(
    new URL("../../../../app/api/skytracker/aircraft/route.ts", import.meta.url),
    "utf8",
  );
  const mapSource = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(scenarioRoute, /isLocalTestEnvironment/);
  assert.match(scenarioRoute, /status: 404/);
  assert.match(aircraftRoute, /budget_stale_fallback/);
  assert.match(aircraftRoute, /Simulated local provider failure/);
  assert.match(mapSource, /Local \/ Test Data/);
});

function withLocalTestMode(action: () => void) {
  const original = {
    nodeEnv: process.env.NODE_ENV,
    mode: process.env.SKYTRACKER_LOCAL_TEST_MODE,
    presentation: process.env.NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT,
    host: process.env.SKYTRACKER_LOCAL_TEST_HOST,
  };
  try {
    Reflect.set(process.env, "NODE_ENV", "development");
    process.env.SKYTRACKER_LOCAL_TEST_MODE = "enabled";
    process.env.NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT = "local-test";
    process.env.SKYTRACKER_LOCAL_TEST_HOST = "127.0.0.1";
    action();
  } finally {
    restore("NODE_ENV", original.nodeEnv);
    restore("SKYTRACKER_LOCAL_TEST_MODE", original.mode);
    restore("NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT", original.presentation);
    restore("SKYTRACKER_LOCAL_TEST_HOST", original.host);
  }
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
