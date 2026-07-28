import test from "node:test";
import assert from "node:assert/strict";
import { parseLiveAircraftSnapshot } from "../../backend/domain/liveAircraftSnapshot.ts";
import { reconcileSnapshot } from "../../backend/domain/snapshotReconciliation.ts";
import { SnapshotAcceptancePolicy } from "../../backend/domain/snapshotAcceptance.ts";
import { normalizeViewportBounds } from "../../backend/domain/viewportBounds.ts";
import {
  createGlobalViewportQuery,
  GLOBAL_QUERY_SPAN_DEGREES,
} from "../../backend/domain/globalViewportQuery.ts";
import {
  MAXIMUM_VISIBLE_TILES,
  planAdaptiveViewport,
} from "../../backend/domain/adaptiveViewportTiles.ts";
import { AircraftTileCache } from "../../backend/domain/aircraftTileCache.ts";
import { fetchLiveAircraft } from "../../backend/infrastructure/liveAircraftClient.ts";
import {
  AdaptiveTileScheduler,
  PRIORITY_TILE_LOAD_INTERVAL_MILLIS,
} from "../../backend/infrastructure/adaptiveTileScheduler.ts";
import { searchGlobalAircraft } from "../../backend/infrastructure/globalAircraftSearchClient.ts";
import {
  AIRCRAFT_EDGE_CACHE_SECONDS,
  aircraftProxyCacheHeaders,
} from "../../backend/infrastructure/aircraftProxyCache.ts";
import { resolveSkyTrackerApiConfig } from "../../backend/infrastructure/skyTrackerApiConfig.ts";
import {
  MOVE_END_DEBOUNCE_MILLIS,
  POLL_INTERVAL_MILLIS,
  MAXIMUM_CLIENT_REQUESTS_PER_DAY,
  REGION_CHANGE_MIN_INTERVAL_MILLIS,
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
  assert.equal(normalizeViewportBounds({ minLat: 1, minLon: 1, maxLat: 1, maxLon: 2 }).valid, false);
  assert.equal(normalizeViewportBounds({ minLat: 1, minLon: 2, maxLat: 2, maxLon: 2 }).valid, false);
});

test("global viewport queries cover world centers with stable bounded windows", () => {
  const centers = [
    [52.15, 5.3],
    [40.71, -74.01],
    [35.68, 139.76],
    [-33.87, 151.21],
    [-23.55, -46.63],
  ] as const;

  for (const [latitude, longitude] of centers) {
    const query = createGlobalViewportQuery(latitude, longitude);
    assert.equal(query.valid, true);
    if (!query.valid) continue;
    assert.equal(query.bounds.maxLat - query.bounds.minLat, GLOBAL_QUERY_SPAN_DEGREES);
    assert.equal(query.bounds.maxLon - query.bounds.minLon, GLOBAL_QUERY_SPAN_DEGREES);
    assert.equal(
      (query.bounds.maxLat - query.bounds.minLat) *
        (query.bounds.maxLon - query.bounds.minLon),
      16,
    );
    assert.ok(latitude >= query.bounds.minLat && latitude <= query.bounds.maxLat);
    assert.ok(longitude >= query.bounds.minLon && longitude <= query.bounds.maxLon);
  }
});

test("global viewport queries handle poles, wrapped longitude and nearby pans deterministically", () => {
  const north = createGlobalViewportQuery(90, 179.5);
  const south = createGlobalViewportQuery(-90, -179.5);
  const wrapped = createGlobalViewportQuery(0, 540);
  const nearbyA = createGlobalViewportQuery(52.1, 5.1);
  const nearbyB = createGlobalViewportQuery(52.4, 5.4);

  assert.deepEqual(north, {
    valid: true,
    bounds: { minLat: 86, minLon: 176, maxLat: 90, maxLon: 180 },
    key: "86:176:90:180",
  });
  assert.deepEqual(south, {
    valid: true,
    bounds: { minLat: -90, minLon: -180, maxLat: -86, maxLon: -176 },
    key: "-90:-180:-86:-176",
  });
  assert.equal(wrapped.valid, true);
  assert.deepEqual(nearbyA, nearbyB);
  assert.deepEqual(createGlobalViewportQuery(Number.NaN, 0), { valid: false });
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

test("successful proxy responses are shared at the edge but never browser-cached", () => {
  assert.deepEqual(aircraftProxyCacheHeaders(true), {
    "Cache-Control": "private, no-store",
    "Vercel-CDN-Cache-Control":
      "public, s-maxage=300, stale-while-revalidate=30",
  });
  assert.deepEqual(aircraftProxyCacheHeaders(false), {
    "Cache-Control": "private, no-store",
  });
  assert.equal(AIRCRAFT_EDGE_CACHE_SECONDS, 300);
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

test("global aircraft search uses only the same-origin proxy and parses results", async () => {
  let requested = "";
  const result = await searchGlobalAircraft(
    " SKY123 ",
    new AbortController().signal,
    async (input) => {
      requested = input.toString();
      return new Response(
        JSON.stringify({
          snapshotId: "global-search",
          generatedAt: 1_700_000_001_000,
          aircraft: [VALID_AIRCRAFT],
        }),
        { status: 200, headers: { "X-Cache-Status": "hit" } },
      );
    },
  );

  assert.equal(requested, "/api/skytracker/aircraft/search?q=SKY123");
  assert.equal(requested.includes("a.run.app"), false);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.aircraft[0].id, "484516");
    assert.equal(result.cacheStatus, "hit");
  }
});

test("global aircraft search validates locally and normalizes failure states", async () => {
  let calls = 0;
  const invalid = await searchGlobalAircraft(
    "!",
    new AbortController().signal,
    async () => {
      calls += 1;
      return new Response();
    },
  );
  const unavailable = await searchGlobalAircraft(
    "SKY123",
    new AbortController().signal,
    async () => new Response("{}", { status: 503 }),
  );
  const malformed = await searchGlobalAircraft(
    "SKY123",
    new AbortController().signal,
    async () => new Response("{", { status: 200 }),
  );

  assert.equal(calls, 0);
  assert.deepEqual(invalid, { ok: false, category: "invalid-query" });
  assert.deepEqual(unavailable, { ok: false, category: "unavailable" });
  assert.deepEqual(malformed, { ok: false, category: "malformed" });
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

test("snapshot acceptance accepts changed coordinates with the same aircraft ID", () => {
  const policy = new SnapshotAcceptancePolicy();
  const first = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 1_000,
    aircraft: [VALID_AIRCRAFT],
  });
  const moved = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-2",
    generatedAt: 2_000,
    aircraft: [{ ...VALID_AIRCRAFT, latitude: 52.2, longitude: 5.2 }],
  });

  assert.deepEqual(policy.evaluate(first), { accepted: true, reason: "initial" });
  assert.deepEqual(policy.evaluate(moved), { accepted: true, reason: "newer" });
});

test("snapshot acceptance deduplicates identical content and rejects older snapshots", () => {
  const policy = new SnapshotAcceptancePolicy();
  const first = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 2_000,
    aircraft: [VALID_AIRCRAFT],
  });
  const sameContent = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-2",
    generatedAt: 3_000,
    aircraft: [VALID_AIRCRAFT],
  });
  const olderChanged = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-old",
    generatedAt: 1_000,
    aircraft: [{ ...VALID_AIRCRAFT, latitude: 52.3 }],
  });

  assert.equal(policy.evaluate(first).accepted, true);
  assert.deepEqual(policy.evaluate(sameContent), {
    accepted: false,
    reason: "duplicate",
  });
  assert.deepEqual(policy.evaluate(olderChanged), {
    accepted: false,
    reason: "older",
  });
});

test("snapshot acceptance permits changed content at the same generated time", () => {
  const policy = new SnapshotAcceptancePolicy();
  const first = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 2_000,
    aircraft: [VALID_AIRCRAFT],
  });
  const changed = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-2",
    generatedAt: 2_000,
    aircraft: [{ ...VALID_AIRCRAFT, altitude: 9_500 }],
  });

  policy.evaluate(first);
  assert.deepEqual(policy.evaluate(changed), {
    accepted: true,
    reason: "changed",
  });
});

test("snapshot acceptance ignores aircraft ordering when deduplicating", () => {
  const policy = new SnapshotAcceptancePolicy();
  const secondAircraft = { ...VALID_AIRCRAFT, id: "406a3d" };
  const first = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-1",
    generatedAt: 2_000,
    aircraft: [VALID_AIRCRAFT, secondAircraft],
  });
  const reordered = parseLiveAircraftSnapshot({
    snapshotId: "snapshot-2",
    generatedAt: 3_000,
    aircraft: [secondAircraft, VALID_AIRCRAFT],
  });

  policy.evaluate(first);
  assert.deepEqual(policy.evaluate(reordered), {
    accepted: false,
    reason: "duplicate",
  });
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

test("region changes load the latest world region promptly without duplicate requests", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  let now = 1_000;
  let calls = 0;
  const scheduler = new ViewportPollingScheduler(
    async () => {
      calls += 1;
      return true;
    },
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => now,
  );

  scheduler.regionChanged("europe");
  scheduler.regionChanged("europe");
  assert.deepEqual(delays, [0]);
  callbacks.shift()?.();
  await Promise.resolve();
  assert.equal(calls, 1);
  callbacks.length = 0;

  now += 5_000;
  scheduler.regionChanged("america");
  scheduler.regionChanged("america");
  assert.equal(delays.at(-1), REGION_CHANGE_MIN_INTERVAL_MILLIS - 5_000);
  callbacks.shift()?.();
  await Promise.resolve();
  assert.equal(calls, 2);
  assert.equal(delays.at(-1), POLL_INTERVAL_MILLIS);
  scheduler.dispose();
});

test("client request ceiling remains below the backend daily provider budget", () => {
  assert.equal(MAXIMUM_CLIENT_REQUESTS_PER_DAY, 240);
  assert.ok(MAXIMUM_CLIENT_REQUESTS_PER_DAY < 300);
  assert.ok(REGION_CHANGE_MIN_INTERVAL_MILLIS > MOVE_END_DEBOUNCE_MILLIS);
});

test("adaptive viewport tiles cover a regional viewport without overlap", () => {
  const plan = planAdaptiveViewport({
    south: 50,
    west: 2,
    north: 55,
    east: 9,
  });
  assert.equal(plan.sampled, false);
  assert.equal(plan.tiles.length, MAXIMUM_VISIBLE_TILES);
  assert.equal(plan.totalTileCount, 6);
  assert.equal(new Set(plan.tiles.map((tile) => tile.key)).size, plan.tiles.length);
  assert.equal(plan.tiles[0].priority, "focus");
  assert.equal(plan.tiles.filter((tile) => tile.priority === "visible").length, 5);
  assert.equal(plan.tiles.filter((tile) => tile.priority === "background").length, 6);
  for (const tile of plan.tiles) {
    assert.equal(
      (tile.bounds.maxLat - tile.bounds.minLat) *
        (tile.bounds.maxLon - tile.bounds.minLon),
      16,
    );
  }
});

test("adaptive viewport uses deterministic representative coverage when zoomed out", () => {
  const world = { south: -85, west: -180, north: 85, east: 180 };
  const first = planAdaptiveViewport(world);
  const second = planAdaptiveViewport(world);
  assert.equal(first.sampled, true);
  assert.equal(first.tiles.length, MAXIMUM_VISIBLE_TILES);
  assert.ok(first.totalTileCount > first.tiles.length);
  assert.deepEqual(first, second);
  assert.ok(first.tiles.some((tile) => tile.bounds.minLon < -100));
  assert.ok(first.tiles.some((tile) => tile.bounds.maxLon > 100));
});

test("adaptive viewport handles an antimeridian viewport with valid tiles", () => {
  const plan = planAdaptiveViewport({
    south: -5,
    west: 170,
    north: 5,
    east: 190,
  });
  assert.ok(plan.tiles.length > 0);
  assert.ok(plan.tiles.every((tile) => tile.bounds.minLon >= -180));
  assert.ok(plan.tiles.every((tile) => tile.bounds.maxLon <= 180));
  assert.ok(plan.tiles.some((tile) => tile.bounds.minLon < -170));
  assert.ok(plan.tiles.some((tile) => tile.bounds.maxLon > 170));
});

test("tile cache reuses snapshots, deduplicates aircraft and evicts old entries", () => {
  const cache = new AircraftTileCache(2, 1_000);
  const firstAircraft = parseLiveAircraftSnapshot({
    snapshotId: "tile-one",
    generatedAt: 1_000,
    aircraft: [VALID_AIRCRAFT],
  }).aircraft[0];
  const newerAircraft = {
    ...firstAircraft,
    latitudeDegrees: 52.3,
    positionTimestampEpochMillis: 1_700_000_001_000,
  };
  cache.put("one", [firstAircraft], 100);
  cache.put("two", [newerAircraft], 200);
  assert.equal(cache.loadedCount(["one", "two"], 500), 2);
  assert.deepEqual(cache.merge(["one", "two"], 500), [newerAircraft]);
  cache.put("three", [], 300);
  assert.equal(cache.loadedCount(["one", "two", "three"], 500), 2);
  assert.equal(cache.loadedCount(["two", "three"], 1_301), 0);
});

test("adaptive scheduler loads missing tiles sequentially and reuses fresh tiles", async () => {
  const callbacks: Array<() => void> = [];
  const delays: number[] = [];
  const loaded = new Set<string>();
  let now = 1_000;
  const runs: string[] = [];
  const scheduler = new AdaptiveTileScheduler(
    async (tile: { key: string }) => {
      runs.push(tile.key);
      loaded.add(tile.key);
      return true;
    },
    (tile) => loaded.has(tile.key),
    ((callback: () => void, delay?: number) => {
      callbacks.push(callback);
      delays.push(delay ?? 0);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => now,
  );

  scheduler.setTiles([{ key: "a" }, { key: "b" }]);
  callbacks.shift()?.();
  await Promise.resolve();
  assert.deepEqual(runs, ["a"]);
  assert.equal(delays.at(-1), PRIORITY_TILE_LOAD_INTERVAL_MILLIS);

  now += PRIORITY_TILE_LOAD_INTERVAL_MILLIS;
  callbacks.shift()?.();
  await Promise.resolve();
  assert.deepEqual(runs, ["a", "b"]);
  assert.equal(delays.at(-1), POLL_INTERVAL_MILLIS);

  scheduler.setTiles([{ key: "a" }, { key: "b" }]);
  assert.equal(delays.at(-1), POLL_INTERVAL_MILLIS);
  scheduler.dispose();
});

test("adaptive scheduler refreshes the focus tile after all desired tiles are fresh", async () => {
  const callbacks: Array<() => void> = [];
  const loaded = new Set(["focus", "visible", "background"]);
  const runs: string[] = [];
  const scheduler = new AdaptiveTileScheduler(
    async (tile: { key: string; priority: string }) => {
      runs.push(tile.key);
      return true;
    },
    (tile) => loaded.has(tile.key),
    ((callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => 1_000,
  );

  scheduler.setTiles([
    { key: "focus", priority: "focus" },
    { key: "visible", priority: "visible" },
    { key: "background", priority: "background" },
  ]);
  callbacks.shift()?.();
  await Promise.resolve();

  assert.deepEqual(runs, ["focus"]);
  scheduler.dispose();
});

test("adaptive scheduler replaces an obsolete pending region before it runs", async () => {
  const callbacks: Array<() => void> = [];
  const runs: string[] = [];
  const scheduler = new AdaptiveTileScheduler(
    async (tile: { key: string; priority: string }) => {
      runs.push(tile.key);
      return true;
    },
    () => false,
    ((callback: () => void) => {
      callbacks.push(callback);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    }),
    () => undefined,
    () => 1_000,
  );

  scheduler.setTiles([{ key: "europe", priority: "focus" }]);
  scheduler.setTiles([{ key: "america", priority: "focus" }]);
  callbacks.at(-1)?.();
  await Promise.resolve();

  assert.deepEqual(runs, ["america"]);
  scheduler.dispose();
});
