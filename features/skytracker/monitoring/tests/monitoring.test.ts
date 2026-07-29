import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DeterministicMonitoringEngine,
  MONITOR_KINDS,
  MONITOR_STATUSES,
  addMonitor,
  createAirportMonitor,
  createFlightMonitor,
  createPatternMonitor,
  createRegionMonitor,
  createMonitor,
  monitorPresentationStatus,
  recognizeLiveMonitoringCommand,
  recognizeMonitoringIntent,
  transitionLiveMonitor,
  updateLiveMonitors,
  type Monitor,
  type MonitorObservation,
  type MonitorTriggerMode,
} from "../index.ts";
import { aircraftId, type Aircraft } from "../../aircraft/domain/aircraft.ts";

const NOW = 1_800_000_000_000;

function monitor(
  triggerMode: MonitorTriggerMode = "once",
  overrides: Partial<Monitor> = {},
): Monitor {
  return {
    ...createMonitor({
      id: "monitor-1",
      kind: "aircraft",
      title: "Watch for A380",
      target: { stableId: "type:a380", label: "Airbus A380" },
      rule: {
        match: "all",
        conditions: [
          {
            id: "type",
            field: "aircraftType",
            operator: "equals",
            expectedValue: "A380",
          },
        ],
      },
      trigger: {
        mode: triggerMode,
        scheduledAtEpochMillis: triggerMode === "scheduled" ? NOW + 500 : null,
      },
      createdAtEpochMillis: NOW - 1_000,
    }),
    ...overrides,
  };
}

function observation(
  values: Readonly<Record<string, unknown>>,
  observedAtEpochMillis = NOW,
): MonitorObservation {
  return {
    values,
    observedAtEpochMillis,
    source: "live-aircraft",
  };
}

test("monitoring domain exposes every approved monitor kind and status", () => {
  assert.deepEqual(MONITOR_KINDS, [
    "flight",
    "aircraft",
    "airport",
    "weather",
    "spotter",
    "news",
  ]);
  assert.deepEqual(MONITOR_STATUSES, [
    "active",
    "paused",
    "triggered",
    "completed",
    "expired",
    "disabled",
  ]);
});

test("monitor creation is normalized and rejects invalid definitions", () => {
  const created = monitor();
  assert.equal(created.state.status, "active");
  assert.equal(created.state.evaluationCount, 0);
  assert.throws(
    () =>
      createMonitor({
        id: "invalid",
        kind: "flight",
        title: "Invalid",
        target: { stableId: "flight", label: "Flight" },
        rule: { match: "all", conditions: [] },
        trigger: { mode: "once", scheduledAtEpochMillis: null },
        createdAtEpochMillis: NOW,
      }),
    /at least one condition/,
  );
});

test("ONCE completes and creates only a non-delivered notification intent", () => {
  const result = new DeterministicMonitoringEngine().evaluate(
    monitor(),
    observation({ aircraftType: "A380" }),
  );
  assert.equal(result.matched, true);
  assert.equal(result.monitor.state.status, "completed");
  assert.equal(result.monitor.state.evaluationCount, 1);
  assert.equal(result.monitor.state.triggerCount, 1);
  assert.equal(result.notificationIntent?.deliveryState, "not-requested");
});

test("CONTINUOUS can trigger and return to active on a later non-match", () => {
  const engine = new DeterministicMonitoringEngine();
  const triggered = engine.evaluate(
    monitor("continuous"),
    observation({ aircraftType: "A380" }),
  ).monitor;
  const active = engine.evaluate(
    triggered,
    observation({ aircraftType: "B748" }, NOW + 1_000),
  ).monitor;
  assert.equal(triggered.state.status, "triggered");
  assert.equal(active.state.status, "active");
});

test("SCHEDULED evaluates only when its due time is reached", () => {
  const engine = new DeterministicMonitoringEngine();
  const pending = engine.evaluate(
    monitor("scheduled"),
    observation({ aircraftType: "A380" }, NOW),
  );
  const due = engine.evaluate(
    monitor("scheduled"),
    observation({ aircraftType: "A380" }, NOW + 500),
  );
  assert.equal(pending.reason, "not-due");
  assert.equal(due.reason, "matched");
});

test("paused and disabled monitors stay inactive, expired monitor expires", () => {
  const engine = new DeterministicMonitoringEngine();
  for (const status of ["paused", "disabled"] as const) {
    const inactive = engine.evaluate(
      engine.transition(monitor(), status),
      observation({ aircraftType: "A380" }),
    );
    assert.equal(inactive.reason, "not-active");
    assert.equal(inactive.monitor.state.evaluationCount, 0);
  }
  const expired = engine.evaluate(
    monitor("once", { expiresAtEpochMillis: NOW }),
    observation({ aircraftType: "A380" }),
  );
  assert.equal(expired.reason, "expired");
  assert.equal(expired.monitor.state.status, "expired");
});

test("all and any condition rules evaluate deterministically", () => {
  const engine = new DeterministicMonitoringEngine();
  const base = monitor("continuous");
  const conditions = [
    { id: "type", field: "type", operator: "contains" as const, expectedValue: "380" },
    { id: "altitude", field: "altitude", operator: "above" as const, expectedValue: 9_000 },
  ];
  const allMonitor = { ...base, rule: { match: "all" as const, conditions } };
  const anyMonitor = { ...base, rule: { match: "any" as const, conditions } };
  const values = observation({ type: "A380", altitude: 8_000 });
  assert.equal(engine.evaluate(allMonitor, values).matched, false);
  assert.equal(engine.evaluate(anyMonitor, values).matched, true);
});

test("SkyGuide recognizes approved monitoring language without executing it", () => {
  const cases = [
    ["Keep an eye on this flight.", "flight"],
    ["Notify me when an A380 appears.", "aircraft"],
    ["Watch Schiphol.", "airport"],
    ["Alert me about low visibility weather.", "weather"],
    ["Monitor rare military aircraft for spotting.", "spotter"],
    ["Let me know about Boeing news.", "news"],
  ] as const;
  for (const [query, kind] of cases) {
    const intent = recognizeMonitoringIntent(query);
    assert.equal(intent.recognized, true);
    assert.equal(intent.kind, kind);
    assert.equal(intent.executionAvailable, false);
  }
  assert.equal(recognizeMonitoringIntent("Explain lift.").recognized, false);
});

test("monitoring foundation has no runtime, persistence or delivery effects", async () => {
  const sources = await Promise.all([
    readFile(new URL("../domain/monitoring.ts", import.meta.url), "utf8"),
    readFile(new URL("../application/monitoringEngine.ts", import.meta.url), "utf8"),
    readFile(new URL("../application/monitoringIntent.ts", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    sources.join("\n"),
    /\b(fetch|localStorage|supabase|setInterval|setTimeout|cron|webhook|pushManager|sendEmail|sendSms)\b/i,
  );
});

test("aircraft details expose the active Watch control", async () => {
  const source = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /"Watch this aircraft"/);
  assert.match(source, /"👁 Watching"/);
  assert.match(source, /onClick=\{watchSelectedAircraft\}/);
});

const LIVE_AIRCRAFT: Aircraft = {
  id: aircraftId("abc123"),
  latitudeDegrees: 52.3,
  longitudeDegrees: 4.8,
  headingDegrees: 180,
  callsign: "SKY123",
  registration: "PH-SKY",
  altitudeMeters: 4_000,
  groundSpeedMetersPerSecond: 180,
  verticalRateMetersPerSecond: -2,
  onGround: false,
  category: "cargo",
  lifecycle: "LIVE",
  positionTimestampEpochMillis: NOW,
};

test("live flight monitor starts, updates and completes when aircraft disappears", () => {
  const started = createFlightMonitor(LIVE_AIRCRAFT, NOW);
  const watching = updateLiveMonitors([started], [LIVE_AIRCRAFT], NOW + 1_000)[0]!;
  const completed = updateLiveMonitors([watching], [], NOW + 2_000)[0]!;
  assert.equal(monitorPresentationStatus(watching.state.status), "watching");
  assert.equal(watching.state.lastEvaluatedAtEpochMillis, NOW + 1_000);
  assert.equal(monitorPresentationStatus(completed.state.status), "completed");
});

test("live monitor pauses, resumes and stops predictably", () => {
  const started = createFlightMonitor(LIVE_AIRCRAFT, NOW);
  const paused = transitionLiveMonitor(started, "pause");
  const resumed = transitionLiveMonitor(paused, "resume");
  const stopped = transitionLiveMonitor(resumed, "stop");
  assert.equal(monitorPresentationStatus(paused.state.status), "paused");
  assert.equal(monitorPresentationStatus(resumed.state.status), "watching");
  assert.equal(monitorPresentationStatus(stopped.state.status), "stopped");
});

test("multiple monitors coexist and duplicate active targets are rejected", () => {
  const flight = createFlightMonitor(LIVE_AIRCRAFT, NOW);
  const region = createRegionMonitor({
    centerLatitudeDegrees: 52,
    centerLongitudeDegrees: 5,
    southLatitudeDegrees: 50,
    westLongitudeDegrees: 3,
    northLatitudeDegrees: 54,
    eastLongitudeDegrees: 7,
  }, NOW + 1);
  const once = addMonitor(addMonitor([], flight), region);
  const deduplicated = addMonitor(once, createFlightMonitor(LIVE_AIRCRAFT, NOW + 2));
  assert.equal(once.length, 2);
  assert.equal(deduplicated.length, 2);
});

test("airport, region, aircraft-pattern and spotter monitors use one framework", () => {
  const airport = createAirportMonitor({
    airport: {
      icaoCode: "EHAM",
      iataCode: "AMS",
      name: "Amsterdam Airport Schiphol",
      latitudeDegrees: 52.31,
      longitudeDegrees: 4.76,
      countryCode: "NL",
    },
    city: "Amsterdam",
    elevationMeters: -3,
    timezone: "Europe/Amsterdam",
    runways: [],
  }, NOW);
  const type = createPatternMonitor("aircraft", "aircraftType", "A380", NOW);
  const airline = createPatternMonitor("aircraft", "airline", "Emirates", NOW);
  const spotter = createPatternMonitor("spotter", "category", "cargo", NOW);
  const updated = updateLiveMonitors([airport, type, airline, spotter], [LIVE_AIRCRAFT], NOW + 1);
  assert.equal(updated.length, 4);
  assert.equal(updated[0]?.state.status, "triggered");
  assert.equal(updated[3]?.state.status, "triggered");
});

test("SkyGuide live commands cover watch, show, pause, resume and stop", () => {
  assert.deepEqual(recognizeLiveMonitoringCommand("Watch this."), {
    action: "watch", kind: "flight", field: null, value: null,
  });
  assert.equal(recognizeLiveMonitoringCommand("Show active monitors.")?.action, "show");
  assert.equal(recognizeLiveMonitoringCommand("Pause monitoring.")?.action, "pause");
  assert.equal(recognizeLiveMonitoringCommand("Resume monitoring.")?.action, "resume");
  assert.equal(recognizeLiveMonitoringCommand("Stop watching.")?.action, "stop");
  assert.deepEqual(recognizeLiveMonitoringCommand("Watch every A380."), {
    action: "watch", kind: "aircraft", field: "aircraftType", value: "A380",
  });
  assert.deepEqual(recognizeLiveMonitoringCommand("Monitor cargo aircraft."), {
    action: "watch", kind: "spotter", field: "category", value: "cargo",
  });
});

test("session restoration is account-gated and no provider route is introduced", async () => {
  const mapSource = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  const repositorySource = await readFile(
    new URL("../infrastructure/sessionMonitoringRepository.ts", import.meta.url),
    "utf8",
  );
  const panelSource = await readFile(
    new URL("../presentation/MonitoringPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mapSource, /accountState\.status !== "account"/);
  assert.match(repositorySource, /window\.sessionStorage/);
  assert.doesNotMatch(repositorySource, /localStorage|fetch|supabase/i);
  assert.match(panelSource, /Active Monitors/);
  assert.match(panelSource, />\s*Pause\s*</);
  assert.match(panelSource, />\s*Resume\s*</);
  assert.match(panelSource, />\s*Stop\s*</);
});
