import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import type { AirportDetails } from "../../airports/domain/airport.ts";
import type { SkyGuideMapContext } from "../../skyguide/domain/skyGuide.ts";
import {
  createMonitor,
  type Monitor,
  type MonitorKind,
  type MonitorStatus,
} from "../domain/monitoring.ts";

export type LiveMonitorPresentationStatus =
  | "watching"
  | "paused"
  | "completed"
  | "stopped";

export function createFlightMonitor(aircraft: Aircraft, now: number): Monitor {
  const label = aircraft.callsign ?? aircraft.registration ?? aircraft.id.toUpperCase();
  return createMonitor({
    id: monitorId("flight", aircraft.id, now),
    kind: "flight",
    title: `Watching ${label}`,
    target: { stableId: aircraft.id, label },
    targetContext: { kind: "aircraft", aircraftId: aircraft.id },
    rule: {
      match: "all",
      conditions: [{ id: "present", field: "present", operator: "equals", expectedValue: true }],
    },
    trigger: { mode: "continuous", scheduledAtEpochMillis: null },
    createdAtEpochMillis: now,
  });
}

export function createAirportMonitor(airport: AirportDetails, now: number): Monitor {
  const stableId = airport.airport.icaoCode ?? airport.airport.name;
  return createMonitor({
    id: monitorId("airport", stableId, now),
    kind: "airport",
    title: `Watching ${airport.airport.name}`,
    target: { stableId, label: airport.airport.name },
    targetContext: {
      kind: "airport",
      icaoCode: airport.airport.icaoCode,
      latitude: airport.airport.latitudeDegrees,
      longitude: airport.airport.longitudeDegrees,
    },
    rule: {
      match: "all",
      conditions: [{ id: "activity", field: "aircraftCount", operator: "above", expectedValue: 0 }],
    },
    trigger: { mode: "continuous", scheduledAtEpochMillis: null },
    createdAtEpochMillis: now,
  });
}

export function createRegionMonitor(viewport: SkyGuideMapContext, now: number): Monitor {
  const stableId = [
    viewport.southLatitudeDegrees,
    viewport.westLongitudeDegrees,
    viewport.northLatitudeDegrees,
    viewport.eastLongitudeDegrees,
  ].map((value) => value.toFixed(2)).join(":");
  return createMonitor({
    id: monitorId("region", stableId, now),
    kind: "spotter",
    title: "Watching this area",
    target: { stableId, label: "Current map area" },
    targetContext: {
      kind: "region",
      south: viewport.southLatitudeDegrees,
      west: viewport.westLongitudeDegrees,
      north: viewport.northLatitudeDegrees,
      east: viewport.eastLongitudeDegrees,
    },
    rule: {
      match: "all",
      conditions: [{ id: "activity", field: "aircraftCount", operator: "above", expectedValue: 0 }],
    },
    trigger: { mode: "continuous", scheduledAtEpochMillis: null },
    createdAtEpochMillis: now,
  });
}

export function createPatternMonitor(
  kind: MonitorKind,
  field: string,
  value: string,
  now: number,
): Monitor {
  const normalized = value.trim();
  return createMonitor({
    id: monitorId(kind, `${field}:${normalized}`, now),
    kind,
    title: `Watching ${normalized}`,
    target: { stableId: `${field}:${normalized}`, label: normalized },
    targetContext: { kind: "pattern", field, value: normalized },
    rule: {
      match: "any",
      conditions: [{
        id: field,
        field,
        operator: "contains",
        expectedValue: normalized,
      }],
    },
    trigger: { mode: "continuous", scheduledAtEpochMillis: null },
    createdAtEpochMillis: now,
  });
}

export function updateLiveMonitors(
  monitors: readonly Monitor[],
  aircraft: readonly Aircraft[],
  now: number,
): readonly Monitor[] {
  return monitors.map((monitor) => {
    if (!["active", "triggered"].includes(monitor.state.status)) return monitor;
    const context = monitor.targetContext;
    let matched = false;

    if (context?.kind === "aircraft") {
      matched = aircraft.some((item) => item.id === context.aircraftId);
      if (!matched && monitor.state.evaluationCount > 0) {
        return withState(monitor, "completed", now, false);
      }
    } else if (context?.kind === "region") {
      matched = aircraft.some((item) => inRegion(item, context));
    } else if (context?.kind === "airport") {
      matched = aircraft.some(
        (item) =>
          Math.abs(item.latitudeDegrees - context.latitude) <= 0.75 &&
          Math.abs(item.longitudeDegrees - context.longitude) <= 1,
      );
    } else if (context?.kind === "pattern") {
      matched = aircraft.some((item) =>
        aircraftField(item, context.field)
          .toLocaleLowerCase()
          .includes(context.value.toLocaleLowerCase()),
      );
    }
    return withState(monitor, matched ? "triggered" : "active", now, matched);
  });
}

export function transitionLiveMonitor(
  monitor: Monitor,
  action: "pause" | "resume" | "stop",
): Monitor {
  const status: MonitorStatus =
    action === "pause" ? "paused" : action === "resume" ? "active" : "disabled";
  return { ...monitor, state: { ...monitor.state, status } };
}

export function monitorPresentationStatus(
  status: MonitorStatus,
): LiveMonitorPresentationStatus {
  if (status === "paused") return "paused";
  if (status === "completed" || status === "expired") return "completed";
  if (status === "disabled") return "stopped";
  return "watching";
}

export function addMonitor(
  monitors: readonly Monitor[],
  monitor: Monitor,
): readonly Monitor[] {
  const duplicate = monitors.find(
    (item) =>
      item.kind === monitor.kind &&
      item.target.stableId === monitor.target.stableId &&
      item.state.status !== "disabled",
  );
  return duplicate ? monitors : [...monitors, monitor];
}

function withState(
  monitor: Monitor,
  status: MonitorStatus,
  now: number,
  matched: boolean,
): Monitor {
  return {
    ...monitor,
    state: {
      ...monitor.state,
      status,
      evaluationCount: monitor.state.evaluationCount + 1,
      triggerCount: monitor.state.triggerCount + (matched ? 1 : 0),
      lastEvaluatedAtEpochMillis: now,
      lastTriggeredAtEpochMillis: matched
        ? now
        : monitor.state.lastTriggeredAtEpochMillis,
    },
  };
}

function inRegion(
  aircraft: Aircraft,
  region: Extract<NonNullable<Monitor["targetContext"]>, { kind: "region" }>,
): boolean {
  const longitudeInside =
    region.west <= region.east
      ? aircraft.longitudeDegrees >= region.west &&
        aircraft.longitudeDegrees <= region.east
      : aircraft.longitudeDegrees >= region.west ||
        aircraft.longitudeDegrees <= region.east;
  return (
    aircraft.latitudeDegrees >= region.south &&
    aircraft.latitudeDegrees <= region.north &&
    longitudeInside
  );
}

function aircraftField(aircraft: Aircraft, field: string): string {
  if (field === "icao24") return aircraft.id;
  if (field === "registration") return aircraft.registration ?? "";
  if (field === "airline") return aircraft.callsign ?? "";
  if (field === "aircraftType") return "";
  if (field === "category") return aircraft.category;
  return aircraft.callsign ?? "";
}

function monitorId(kind: string, target: string, now: number): string {
  return `${kind}:${target.toLocaleLowerCase()}:${now}`;
}
