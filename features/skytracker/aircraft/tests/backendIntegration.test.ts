import test from "node:test";
import assert from "node:assert/strict";
import { parseLiveAircraftSnapshot } from "../../backend/domain/liveAircraftSnapshot.ts";
import { reconcileSnapshot } from "../../backend/domain/snapshotReconciliation.ts";
import { normalizeViewportBounds } from "../../backend/domain/viewportBounds.ts";
import { fetchLiveAircraft } from "../../backend/infrastructure/liveAircraftClient.ts";
import { resolveSkyTrackerApiConfig } from "../../backend/infrastructure/skyTrackerApiConfig.ts";
import {
  POLL_INTERVAL_MILLIS,
  ViewportPollingScheduler,
} from "../../backend/infrastructure/viewportPollingScheduler.ts";
import { aircraftId } from "../domain/aircraft.ts";

const VALID_AIRCRAFT = {
  id: "484516",
  latitude: 52.1,
  longitude: 5.1,
  positionTimestamp: 1_700_000_000_000,
  heading: 90,
  groundSpeed: 200,
  altitude: 9_000,
  verticalRate: 1,
  onGround: false,
  callsign: " SKY123 ",
  registration: null,
  category: "passenger",
  lifecycle: "FRESH",
};

test("API config normalizes trailing slashes and rejects missing or production localhost", () => {
  assert.deepEqual(resolveSkyTrackerApiConfig("http://localhost:8080///", "development"), {
    configured: true,
    baseUrl: "http://localhost:8080",
  });
  assert.deepEqual(resolveSkyTrackerApiConfig("", "development"), {
    configured: false,
    reason: "missing",
  });
  assert.deepEqual(resolveSkyTrackerApiConfig("http://localhost:8080", "production"), {
    configured: false,
    reason: "production-localhost",
  });
});

test("viewport bounds are precise, bounded and reject antimeridian and non-finite values", () => {
  assert.deepEqual(
    normalizeViewportBounds({ minLat: 50.123456, minLon: 3, maxLat: 54, maxLon: 7 }),
    {
      valid: true,
      bounds: { minLat: 50.12346, minLon: 3, maxLat: 54, maxLon: 7 },
      key: "50.12346:3:54:7",
    },
  );
  assert.equal(normalizeViewportBounds({ minLat: 0, minLon: 170, maxLat: 1, maxLon: -170 }).valid, false);
  assert.equal(normalizeViewportBounds({ minLat: 0, minLon: 0, maxLat: 31, maxLon: 1 }).valid, false);
  assert.equal(normalizeViewportBounds({ minLat: 50, minLon: 3, maxLat: 55, maxLon: 7 }).valid, false);
  assert.equal(normalizeViewportBounds({ minLat: 50.5, minLon: 3.5, maxLat: 54.5, maxLon: 7.5 }).valid, true);
  assert.equal(normalizeViewportBounds({ minLat: Number.NaN, minLon: 0, maxLat: 1, maxLon: 1 }).valid, false);
});

test("snapshot parser maps SI units, nullability and lifecycle", () => {
  const parsed = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 1_700_000_001_000,
    aircraft: [VALID_AIRCRAFT, { ...VALID_AIRCRAFT, id: "stale1", heading: null, lifecycle: "STALE" }],
  });
  assert.equal(parsed.aircraft.length, 2);
  assert.equal(parsed.aircraft[0].groundSpeedMetersPerSecond, 200);
  assert.equal(parsed.aircraft[0].verticalRateMetersPerSecond, 1);
  assert.equal(parsed.aircraft[0].callsign, "SKY123");
  assert.equal(parsed.aircraft[1].headingDegrees, null);
  assert.equal(parsed.aircraft[1].lifecycle, "STALE");
});

test("snapshot parser normalizes omitted nullable fields to null", () => {
  const parsed = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-omitted",
    generatedAt: 1_700_000_001_000,
    aircraft: [{
      id: "406a3d",
      latitude: 51.5,
      longitude: 4.5,
      positionTimestamp: 1_700_000_000_000,
      groundSpeed: 180,
      altitude: 7_300,
      onGround: false,
      callsign: "SKY553",
      category: "unknown",
      lifecycle: "STALE",
    }],
  });
  assert.equal(parsed.aircraft.length, 1);
  assert.equal(parsed.aircraft[0].headingDegrees, null);
  assert.equal(parsed.aircraft[0].verticalRateMetersPerSecond, null);
  assert.equal(parsed.aircraft[0].registration, null);
});

test("snapshot parser rejects bad records and duplicates while retaining valid aircraft", () => {
  const parsed = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 1_700_000_001_000,
    aircraft: [
      VALID_AIRCRAFT,
      { ...VALID_AIRCRAFT },
      { ...VALID_AIRCRAFT, id: "bad", latitude: 100 },
    ],
  });
  assert.equal(parsed.aircraft.length, 1);
  assert.equal(parsed.rawAircraftCount, 3);
  assert.equal(parsed.rejectedAircraftCount, 2);
  assert.throws(() => parseLiveAircraftSnapshot({ snapshotId: "", aircraft: [] }));
  assert.equal(parseLiveAircraftSnapshot({
    snapshotId: "empty",
    generatedAt: 1,
    aircraft: [],
  }).aircraft.length, 0);
});

test("client builds the bounded URL and reads safe response headers", async () => {
  let requested = "";
  let receivedSignal: AbortSignal | undefined;
  const result = await fetchLiveAircraft(
    { minLat: 50, minLon: 3, maxLat: 54, maxLon: 9 },
    new AbortController().signal,
    async (input, init) => {
      requested = input.toString();
      receivedSignal = init?.signal ?? undefined;
      return new Response(JSON.stringify({
        snapshotId: "snapshot-1",
        generatedAt: 1_700_000_001_000,
        aircraft: [VALID_AIRCRAFT],
      }), {
        status: 200,
        headers: { "X-Request-ID": "request-1", "X-Cache-Status": "hit", ETag: "\"abc\"" },
      });
    },
  );
  assert.match(requested, /^\/api\/skytracker\/aircraft\?/);
  assert.match(requested, /minLat=50/);
  assert.ok(receivedSignal);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.requestId, "request-1");
    assert.equal(result.cacheStatus, "hit");
  }
});

test("client maps viewport, unavailable and malformed responses", async () => {
  const signal = new AbortController().signal;
  const fetchStatus = (status: number) =>
    fetchLiveAircraft({ minLat: 1, minLon: 1, maxLat: 2, maxLon: 2 }, signal,
      async () => new Response("{}", { status }));
  assert.deepEqual(await fetchStatus(413), {
    ok: false, category: "viewport", retryable: false, requestId: null,
  });
  assert.deepEqual(await fetchStatus(503), {
    ok: false, category: "unavailable", retryable: true, requestId: null,
  });
  const malformed = await fetchLiveAircraft(
    { minLat: 1, minLon: 1, maxLat: 2, maxLon: 2 },
    signal,
    async () => new Response("{", { status: 200 }),
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.category, "malformed");
});

test("reconciliation preserves or clears ID based selection deterministically", () => {
  const aircraft = [parseLiveAircraftSnapshot({
    snapshotId: "one",
    generatedAt: 1,
    aircraft: [VALID_AIRCRAFT],
  }).aircraft[0]];
  assert.equal(reconcileSnapshot(aircraft, aircraftId("484516")).selectionRemoved, false);
  const removed = reconcileSnapshot([], aircraftId("484516"));
  assert.equal(removed.selectionRemoved, true);
  assert.equal(removed.selectedAircraftId, null);
});

test("polling scheduler starts once, avoids overlap and schedules after completion", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  let resolveRun: (value: boolean) => void = () =>
    assert.fail("polling run resolver was not initialized");
  let calls = 0;
  const scheduler = new ViewportPollingScheduler(
    () => {
      calls += 1;
      return new Promise<boolean>((resolve) => {
        resolveRun = resolve;
      });
    },
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => 1_000,
  );
  scheduler.start();
  scheduler.start();
  assert.deepEqual(delays, [0]);
  callbacks.shift()?.();
  callbacks.shift()?.();
  assert.equal(calls, 1);
  resolveRun(true);
  await Promise.resolve();
  assert.equal(delays.at(-1), POLL_INTERVAL_MILLIS);
  scheduler.dispose();
});

test("polling scheduler applies bounded backoff and resets after success", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  const outcomes = [false, false, true];
  const scheduler = new ViewportPollingScheduler(
    async () => outcomes.shift() ?? true,
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
  );
  scheduler.start();
  for (let index = 0; index < 3; index += 1) {
    callbacks.shift()?.();
    await Promise.resolve();
  }
  assert.deepEqual(delays, [
    0,
    POLL_INTERVAL_MILLIS,
    2 * POLL_INTERVAL_MILLIS,
    POLL_INTERVAL_MILLIS,
  ]);
  scheduler.dispose();
});

test("polling scheduler default browser timers remain bound", () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let scheduled = false;
  globalThis.setTimeout = function (this: typeof globalThis) {
    assert.equal(this, globalThis);
    scheduled = true;
    return 1 as unknown as ReturnType<typeof setTimeout>;
  } as unknown as typeof setTimeout;
  globalThis.clearTimeout = (() => undefined) as typeof clearTimeout;
  try {
    const scheduler = new ViewportPollingScheduler(async () => true);
    scheduler.start();
    assert.equal(scheduled, true);
    scheduler.dispose();
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("polling scheduler immediately replaces an aborted obsolete viewport run", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  let resolveRun: (value: boolean) => void = () =>
    assert.fail("polling run resolver was not initialized");
  const scheduler = new ViewportPollingScheduler(
    () => new Promise<boolean>((resolve) => {
      resolveRun = resolve;
    }),
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => 1_000,
  );
  scheduler.start();
  callbacks.shift()?.();
  scheduler.reset();
  resolveRun(true);
  await Promise.resolve();
  assert.deepEqual(delays, [0, POLL_INTERVAL_MILLIS]);
  scheduler.dispose();
});

test("polling scheduler does not let resets or visibility resumes bypass the provider budget interval", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  let now = 1_000;
  const scheduler = new ViewportPollingScheduler(
    async () => true,
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => now,
  );

  scheduler.start();
  callbacks.shift()?.();
  await Promise.resolve();
  now += 30_000;
  scheduler.reset();
  scheduler.pause();
  scheduler.resume();

  assert.equal(delays[0], 0);
  assert.equal(delays.at(-1), POLL_INTERVAL_MILLIS - 30_000);
  scheduler.dispose();
});

test("a locally skipped viewport does not consume the throttle interval", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  const scheduler = new ViewportPollingScheduler(
    async () => "skipped",
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
  );

  scheduler.start();
  callbacks.shift()?.();
  await Promise.resolve();
  scheduler.reset();

  assert.deepEqual(delays, [0, POLL_INTERVAL_MILLIS, 0]);
  scheduler.dispose();
});
