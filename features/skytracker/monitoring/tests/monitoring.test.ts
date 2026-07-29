import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DeterministicMonitoringEngine,
  ALERT_TRIGGER_KINDS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  MONITOR_KINDS,
  NOTIFICATION_DELIVERY_STATUSES,
  MONITOR_STATUSES,
  addMonitor,
  appendSessionAlerts,
  createAirportMonitor,
  createFlightMonitor,
  createPatternMonitor,
  createRegionMonitor,
  createMonitor,
  dismissAlert,
  dismissNotification,
  evaluateLiveAlerts,
  monitorPresentationStatus,
  markNotificationRead,
  recognizeLiveMonitoringCommand,
  recognizeMonitoringIntent,
  SessionNotificationDeliveryService,
  transitionLiveMonitor,
  updateLiveMonitors,
  type Monitor,
  type MonitorObservation,
  type MonitorTriggerMode,
  type MonitoringAlert,
  type SessionNotification,
} from "../index.ts";
import { aircraftId, type Aircraft } from "../../aircraft/domain/aircraft.ts";
import { createBrowserNotificationAdapter } from "../infrastructure/browserNotificationAdapter.ts";

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
  assert.equal(recognizeLiveMonitoringCommand("What happened?")?.action, "show-alerts");
  assert.equal(recognizeLiveMonitoringCommand("Show alerts.")?.action, "show-alerts");
  assert.equal(recognizeLiveMonitoringCommand("Why did this trigger?")?.action, "explain-alert");
  assert.equal(recognizeLiveMonitoringCommand("Dismiss alert.")?.action, "dismiss-alert");
  assert.equal(recognizeLiveMonitoringCommand("Clear alerts.")?.action, "clear-alerts");
  assert.equal(recognizeLiveMonitoringCommand("Notify me.")?.action, "notifications-on");
  assert.equal(recognizeLiveMonitoringCommand("Turn notifications off.")?.action, "notifications-off");
  assert.equal(recognizeLiveMonitoringCommand("What notifications are active?")?.action, "show-notifications");
  assert.equal(recognizeLiveMonitoringCommand("Mark notifications as read.")?.action, "read-notifications");
  assert.equal(recognizeLiveMonitoringCommand("Why was I notified?")?.action, "explain-notification");
  assert.equal(recognizeLiveMonitoringCommand("Pause these alerts.")?.action, "pause-alerts");
  assert.equal(recognizeLiveMonitoringCommand("Resume these alerts.")?.action, "resume-alerts");
});

test("flight triggers use only changes between reliable snapshots", () => {
  const flight = createFlightMonitor(LIVE_AIRCRAFT, NOW - 1_000);
  const changed: Aircraft = {
    ...LIVE_AIRCRAFT,
    altitudeMeters: 2_500,
    groundSpeedMetersPerSecond: 100,
    onGround: true,
    lifecycle: "STALE",
    positionTimestampEpochMillis: NOW + 1_000,
  };
  const result = evaluateLiveAlerts([flight], [LIVE_AIRCRAFT], [changed], NOW);
  assert.deepEqual(
    new Set(result.alerts.map((alert) => alert.trigger)),
    new Set([
      "lifecycle-changed",
      "landing-detected",
      "altitude-changed",
      "speed-changed",
    ]),
  );
});

test("flight disappearance and reappearance produce bounded informative alerts", () => {
  const flight = createFlightMonitor(LIVE_AIRCRAFT, NOW - 1_000);
  const watching = updateLiveMonitors([flight], [LIVE_AIRCRAFT], NOW - 500)[0]!;
  const disappeared = evaluateLiveAlerts([watching], [LIVE_AIRCRAFT], [], NOW);
  const reappeared = evaluateLiveAlerts(
    disappeared.monitors,
    [],
    [LIVE_AIRCRAFT],
    NOW + 1_000,
  );
  assert.equal(disappeared.alerts[0]?.trigger, "aircraft-disappeared");
  assert.equal(reappeared.alerts[0]?.trigger, "aircraft-reappeared");
});

test("departure, pattern and spotter triggers are edge based", () => {
  const onGround = { ...LIVE_AIRCRAFT, onGround: true };
  const flight = createFlightMonitor(onGround, NOW - 1_000);
  const cargo = createPatternMonitor("spotter", "category", "cargo", NOW - 1_000);
  const result = evaluateLiveAlerts([flight, cargo], [onGround], [LIVE_AIRCRAFT], NOW);
  assert.equal(result.alerts.some((alert) => alert.trigger === "departure-detected"), true);
  assert.equal(result.alerts.some((alert) => alert.trigger === "aircraft-appeared"), false);
  const appearing = evaluateLiveAlerts([cargo], [], [LIVE_AIRCRAFT], NOW + 1);
  assert.equal(appearing.alerts[0]?.trigger, "aircraft-appeared");
});

test("region entry and exit are derived from stable aircraft IDs", () => {
  const region = createRegionMonitor({
    centerLatitudeDegrees: 52,
    centerLongitudeDegrees: 5,
    southLatitudeDegrees: 50,
    westLongitudeDegrees: 3,
    northLatitudeDegrees: 54,
    eastLongitudeDegrees: 7,
  }, NOW - 1_000);
  const outside = { ...LIVE_AIRCRAFT, latitudeDegrees: 48 };
  const entered = evaluateLiveAlerts([region], [outside], [LIVE_AIRCRAFT], NOW);
  const left = evaluateLiveAlerts([region], [LIVE_AIRCRAFT], [outside], NOW + 1);
  assert.equal(entered.alerts[0]?.trigger, "region-entered");
  assert.equal(left.alerts[0]?.trigger, "region-left");
});

test("airport activity changes only when the reliable nearby count changes", () => {
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
  }, NOW - 1_000);
  const increased = evaluateLiveAlerts([airport], [], [LIVE_AIRCRAFT], NOW);
  const unchanged = evaluateLiveAlerts([airport], [LIVE_AIRCRAFT], [LIVE_AIRCRAFT], NOW + 1);
  const decreased = evaluateLiveAlerts([airport], [LIVE_AIRCRAFT], [], NOW + 2);
  assert.equal(increased.alerts[0]?.trigger, "airport-activity-increased");
  assert.equal(unchanged.alerts.length, 0);
  assert.equal(decreased.alerts[0]?.trigger, "airport-activity-decreased");
});

test("alert center keeps twenty newest unique session alerts and supports dismiss", () => {
  const monitor = createFlightMonitor(LIVE_AIRCRAFT, NOW - 1_000);
  const alerts = Array.from({ length: 23 }, (_, index) => ({
    id: `alert-${index}`,
    monitorId: monitor.id,
    trigger: ALERT_TRIGGER_KINDS[index % ALERT_TRIGGER_KINDS.length]!,
    timestampEpochMillis: NOW + index,
    severity: "info" as const,
    title: `Alert ${index}`,
    description: "Observed from a live snapshot.",
    status: "new" as const,
  }));
  const bounded = appendSessionAlerts([], alerts);
  assert.equal(bounded.length, 20);
  assert.equal(bounded[0]?.id, "alert-22");
  assert.equal(dismissAlert(bounded[0]!, "alert-22").status, "dismissed");
});

function monitoringAlert(
  overrides: Partial<MonitoringAlert> = {},
): MonitoringAlert {
  return {
    id: "alert-delivery-1",
    monitorId: "monitor-delivery",
    trigger: "landing-detected",
    timestampEpochMillis: NOW,
    severity: "notice",
    title: "Landing detected",
    description: "SKY123 is now reported on the ground.",
    status: "new",
    ...overrides,
  };
}

function deliveryMonitor(): Monitor {
  return createMonitor({
    id: "monitor-delivery",
    kind: "flight",
    title: "Watching SKY123",
    target: { stableId: LIVE_AIRCRAFT.id, label: "SKY123" },
    targetContext: { kind: "aircraft", aircraftId: LIVE_AIRCRAFT.id },
    rule: {
      match: "all",
      conditions: [
        { id: "present", field: "present", operator: "equals", expectedValue: true },
      ],
    },
    trigger: { mode: "continuous", scheduledAtEpochMillis: null },
    createdAtEpochMillis: NOW - 10_000,
  });
}

test("alert becomes a bounded in-app notification with target context", () => {
  const delivered = new SessionNotificationDeliveryService().enqueue(
    [monitoringAlert()],
    [deliveryMonitor()],
    [],
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW,
  );
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0]?.status, "delivered");
  assert.equal(delivered[0]?.browserDeliveryStatus, "not-requested");
  assert.deepEqual(delivered[0]?.target, {
    kind: "aircraft",
    aircraftId: LIVE_AIRCRAFT.id,
  });
});

test("delivery policy deduplicates, cools down and suppresses disabled severity", () => {
  const service = new SessionNotificationDeliveryService();
  const monitor = deliveryMonitor();
  const first = service.enqueue(
    [monitoringAlert()],
    [monitor],
    [],
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW,
  );
  const duplicate = service.enqueue(
    [monitoringAlert()],
    [monitor],
    first,
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW + 1_000,
  );
  assert.equal(
    duplicate.find((item) => item.alertId === "alert-delivery-1")?.status,
    "delivered",
  );
  const cooldown = service.enqueue(
    [monitoringAlert({
      id: "alert-delivery-2",
      title: "Flight status changed",
      timestampEpochMillis: NOW + 2_000,
    })],
    [monitor],
    first,
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW + 2_000,
  );
  assert.equal(cooldown[0]?.suppressionReason, "monitor-cooldown");
  const disabled = service.enqueue(
    [monitoringAlert({ id: "alert-delivery-3" })],
    [monitor],
    [],
    { ...DEFAULT_NOTIFICATION_PREFERENCES, importantAlertsEnabled: false },
    NOW,
  );
  assert.equal(disabled[0]?.suppressionReason, "important-alerts-disabled");
});

test("continuous alerts are session-rate-limited without disturbing monitors", () => {
  const service = new SessionNotificationDeliveryService();
  const monitor = deliveryMonitor();
  const existing: SessionNotification[] = Array.from(
    { length: 12 },
    (_, index) => ({
      id: `notification-existing-${index}`,
      alertId: `alert-existing-${index}`,
      monitorId: `another-monitor-${index}`,
      monitorKind: "flight",
      createdAtEpochMillis: NOW - index,
      severity: "info",
      title: `Existing ${index}`,
      description: "Existing notification.",
      reason: "aircraft appeared",
      target: null,
      status: "delivered",
      browserDeliveryStatus: "not-requested",
      suppressionReason: null,
    }),
  );
  const result = service.enqueue(
    [monitoringAlert({ id: "rate-limited" })],
    [monitor],
    existing,
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW,
  );
  assert.equal(result[0]?.suppressionReason, "session-rate-limit");
  assert.equal(monitor.state.status, "active");
});

test("notification read, dismiss and delivery statuses are explicit", () => {
  assert.deepEqual(NOTIFICATION_DELIVERY_STATUSES, [
    "queued",
    "delivered",
    "read",
    "dismissed",
    "failed",
    "suppressed",
  ]);
  const notification = new SessionNotificationDeliveryService().enqueue(
    [monitoringAlert()],
    [deliveryMonitor()],
    [],
    DEFAULT_NOTIFICATION_PREFERENCES,
    NOW,
  )[0]!;
  assert.equal(markNotificationRead(notification).status, "read");
  assert.equal(dismissNotification(notification).status, "dismissed");
});

test("browser permission is requested only explicitly and denial is respected", async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let requestCount = 0;
  class DeniedNotification {
    static permission = "default";
    static async requestPermission() {
      requestCount += 1;
      DeniedNotification.permission = "denied";
      return "denied";
    }
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { Notification: DeniedNotification },
  });
  try {
    const adapter = createBrowserNotificationAdapter();
    assert.equal(requestCount, 0);
    assert.equal(adapter.permission(), "default");
    assert.equal(await adapter.requestPermission(), "denied");
    assert.equal(requestCount, 1);
    const notification = new SessionNotificationDeliveryService().enqueue(
      [monitoringAlert()],
      [deliveryMonitor()],
      [],
      DEFAULT_NOTIFICATION_PREFERENCES,
      NOW,
    )[0]!;
    assert.equal(await adapter.deliver(notification), "suppressed");
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, "window", originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
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
  const alertPanelSource = await readFile(
    new URL("../presentation/AlertCenter.tsx", import.meta.url),
    "utf8",
  );
  const alertRepositorySource = await readFile(
    new URL("../infrastructure/sessionAlertRepository.ts", import.meta.url),
    "utf8",
  );
  const browserAdapterSource = await readFile(
    new URL("../infrastructure/browserNotificationAdapter.ts", import.meta.url),
    "utf8",
  );
  const notificationRepositorySource = await readFile(
    new URL("../infrastructure/sessionNotificationRepository.ts", import.meta.url),
    "utf8",
  );
  const notificationPanelSource = await readFile(
    new URL("../presentation/NotificationCenter.tsx", import.meta.url),
    "utf8",
  );
  assert.match(mapSource, /accountState\.status !== "account"/);
  assert.match(repositorySource, /window\.sessionStorage/);
  assert.doesNotMatch(repositorySource, /localStorage|fetch|supabase/i);
  assert.match(panelSource, /Active Monitors/);
  assert.match(panelSource, />\s*Pause\s*</);
  assert.match(panelSource, />\s*Resume\s*</);
  assert.match(panelSource, />\s*Stop\s*</);
  assert.match(alertPanelSource, />\s*Dismiss\s*</);
  assert.match(alertPanelSource, />\s*Clear\s*</);
  assert.match(alertRepositorySource, /window\.sessionStorage/);
  assert.doesNotMatch(alertRepositorySource, /localStorage|fetch|supabase/i);
  assert.match(browserAdapterSource, /requestPermission\(\)/);
  assert.match(browserAdapterSource, /Notification\.permission !== "granted"/);
  assert.match(mapSource, /const enableBrowserNotifications = useCallback/);
  assert.match(notificationPanelSource, /onClick=\{props\.onEnableBrowser\}/);
  assert.match(notificationRepositorySource, /window\.sessionStorage/);
  assert.doesNotMatch(notificationRepositorySource, /localStorage|fetch|supabase/i);
  assert.match(notificationPanelSource, /Notifications work while SkyTracker is open/);
  assert.match(notificationPanelSource, /Mark all as read/);
});
