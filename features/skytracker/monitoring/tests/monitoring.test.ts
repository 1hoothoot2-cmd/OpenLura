import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DeterministicMonitoringEngine,
  MONITOR_KINDS,
  MONITOR_STATUSES,
  createMonitor,
  recognizeMonitoringIntent,
  type Monitor,
  type MonitorObservation,
  type MonitorTriggerMode,
} from "../index.ts";

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

test("aircraft details expose only a disabled Monitor preparation", async () => {
  const source = await readFile(
    new URL("../../map/components/SkyTrackerLiveMap.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /aria-label="Monitor aircraft \(coming soon\)"/);
  assert.match(source, /disabled[\s\S]{0,250}Monitor/);
  assert.doesNotMatch(source, /onClick=\{[^}]*monitor/i);
});
