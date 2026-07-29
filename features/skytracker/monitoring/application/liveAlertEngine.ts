import type { Aircraft } from "../../aircraft/domain/aircraft.ts";
import type { Monitor } from "../domain/monitoring.ts";
import type {
  AlertSeverity,
  AlertTriggerKind,
  MonitoringAlert,
} from "../domain/alert.ts";
import { updateLiveMonitors } from "./liveMonitoringSession.ts";

const SIGNIFICANT_ALTITUDE_CHANGE_METERS = 1_000;
const SIGNIFICANT_SPEED_CHANGE_METERS_PER_SECOND = 50;

export interface LiveAlertEvaluation {
  monitors: readonly Monitor[];
  alerts: readonly MonitoringAlert[];
}

export function evaluateLiveAlerts(
  monitors: readonly Monitor[],
  previousAircraft: readonly Aircraft[],
  currentAircraft: readonly Aircraft[],
  now: number,
): LiveAlertEvaluation {
  const updatedMonitors = updateLiveMonitors(monitors, currentAircraft, now);
  const previousById = indexAircraft(previousAircraft);
  const currentById = indexAircraft(currentAircraft);
  const alerts: MonitoringAlert[] = [];

  for (const monitor of monitors) {
    if (monitor.state.status === "paused" || monitor.state.status === "disabled") {
      continue;
    }
    const context = monitor.targetContext;
    if (!context) continue;

    if (context.kind === "aircraft") {
      alerts.push(
        ...flightAlerts(
          monitor,
          previousById.get(context.aircraftId),
          currentById.get(context.aircraftId),
          now,
        ),
      );
      continue;
    }

    if (context.kind === "pattern") {
      alerts.push(
        ...patternAlerts(monitor, context.field, context.value, previousAircraft, currentAircraft, now),
      );
      continue;
    }

    if (context.kind === "region") {
      alerts.push(
        ...areaAlerts(
          monitor,
          previousAircraft.filter((aircraft) => inRegion(aircraft, context)),
          currentAircraft.filter((aircraft) => inRegion(aircraft, context)),
          "region",
          now,
        ),
      );
      continue;
    }

    alerts.push(
      ...airportActivityAlerts(
        monitor,
        nearbyAircraft(previousAircraft, context.latitude, context.longitude),
        nearbyAircraft(currentAircraft, context.latitude, context.longitude),
        now,
      ),
    );
  }

  return { monitors: updatedMonitors, alerts };
}

function flightAlerts(
  monitor: Monitor,
  previous: Aircraft | undefined,
  current: Aircraft | undefined,
  now: number,
): readonly MonitoringAlert[] {
  if (previous && !current) {
    return [alert(monitor, "aircraft-disappeared", "Aircraft left the live feed", `${monitor.target.label} is no longer present in the latest live snapshot.`, now)];
  }
  if (!previous && current && monitor.state.evaluationCount > 0) {
    return [alert(monitor, "aircraft-reappeared", "Aircraft is visible again", `${monitor.target.label} has reappeared in the live feed.`, now)];
  }
  if (!previous || !current) return [];

  const alerts: MonitoringAlert[] = [];
  if (previous.lifecycle !== current.lifecycle) {
    alerts.push(alert(monitor, "lifecycle-changed", "Flight status changed", `${monitor.target.label} changed from ${(previous.lifecycle ?? "unknown").toLowerCase()} to ${(current.lifecycle ?? "unknown").toLowerCase()}.`, now));
  }
  if (!previous.onGround && current.onGround) {
    alerts.push(alert(monitor, "landing-detected", "Landing detected", `${monitor.target.label} is now reported on the ground.`, now, "notice"));
  } else if (previous.onGround && !current.onGround) {
    alerts.push(alert(monitor, "departure-detected", "Departure detected", `${monitor.target.label} is now reported airborne.`, now, "notice"));
  }
  if (
    previous.altitudeMeters !== null &&
    current.altitudeMeters !== null &&
    Math.abs(current.altitudeMeters - previous.altitudeMeters) >= SIGNIFICANT_ALTITUDE_CHANGE_METERS
  ) {
    const direction = current.altitudeMeters > previous.altitudeMeters ? "climbed" : "descended";
    alerts.push(alert(monitor, "altitude-changed", "Significant altitude change", `${monitor.target.label} ${direction} by ${Math.round(Math.abs(current.altitudeMeters - previous.altitudeMeters))} metres.`, now));
  }
  if (
    previous.groundSpeedMetersPerSecond !== null &&
    current.groundSpeedMetersPerSecond !== null &&
    Math.abs(current.groundSpeedMetersPerSecond - previous.groundSpeedMetersPerSecond) >=
      SIGNIFICANT_SPEED_CHANGE_METERS_PER_SECOND
  ) {
    alerts.push(alert(monitor, "speed-changed", "Significant speed change", `${monitor.target.label}'s ground speed changed by ${Math.round(Math.abs(current.groundSpeedMetersPerSecond - previous.groundSpeedMetersPerSecond))} metres per second.`, now));
  }
  return alerts;
}

function patternAlerts(
  monitor: Monitor,
  field: string,
  value: string,
  previousAircraft: readonly Aircraft[],
  currentAircraft: readonly Aircraft[],
  now: number,
): readonly MonitoringAlert[] {
  const previousIds = new Set(previousAircraft.filter((item) => matchesPattern(item, field, value)).map((item) => item.id));
  return currentAircraft
    .filter((item) => matchesPattern(item, field, value) && !previousIds.has(item.id))
    .map((item) =>
      alert(
        monitor,
        "aircraft-appeared",
        `${monitor.target.label} detected`,
        `${aircraftLabel(item)} appeared in the live snapshot.`,
        now,
        "notice",
        item.id,
      ),
    );
}

function areaAlerts(
  monitor: Monitor,
  previousAircraft: readonly Aircraft[],
  currentAircraft: readonly Aircraft[],
  areaKind: "region",
  now: number,
): readonly MonitoringAlert[] {
  const previousIds = new Set(previousAircraft.map((item) => item.id));
  const currentIds = new Set(currentAircraft.map((item) => item.id));
  const entered = currentAircraft.filter((item) => !previousIds.has(item.id));
  const left = previousAircraft.filter((item) => !currentIds.has(item.id));
  return [
    ...entered.map((item) => alert(monitor, "region-entered", "Aircraft entered watched area", `${aircraftLabel(item)} entered ${monitor.target.label.toLowerCase()}.`, now, "info", `${areaKind}:in:${item.id}`)),
    ...left.map((item) => alert(monitor, "region-left", "Aircraft left watched area", `${aircraftLabel(item)} left ${monitor.target.label.toLowerCase()}.`, now, "info", `${areaKind}:out:${item.id}`)),
  ];
}

function airportActivityAlerts(
  monitor: Monitor,
  previousAircraft: readonly Aircraft[],
  currentAircraft: readonly Aircraft[],
  now: number,
): readonly MonitoringAlert[] {
  if (previousAircraft.length === currentAircraft.length) return [];
  const increased = currentAircraft.length > previousAircraft.length;
  return [
    alert(
      monitor,
      increased ? "airport-activity-increased" : "airport-activity-decreased",
      `Airport activity ${increased ? "increased" : "decreased"}`,
      `${monitor.target.label} changed from ${previousAircraft.length} to ${currentAircraft.length} nearby live aircraft.`,
      now,
    ),
  ];
}

function alert(
  monitor: Monitor,
  trigger: AlertTriggerKind,
  title: string,
  description: string,
  now: number,
  severity: AlertSeverity = "info",
  discriminator = "",
): MonitoringAlert {
  return {
    id: `${monitor.id}:${trigger}:${now}:${discriminator}`,
    monitorId: monitor.id,
    trigger,
    timestampEpochMillis: now,
    severity,
    title,
    description,
    status: "new",
  };
}

function indexAircraft(aircraft: readonly Aircraft[]): ReadonlyMap<string, Aircraft> {
  return new Map(aircraft.map((item) => [item.id, item]));
}

function nearbyAircraft(
  aircraft: readonly Aircraft[],
  latitude: number,
  longitude: number,
): readonly Aircraft[] {
  return aircraft.filter(
    (item) =>
      Math.abs(item.latitudeDegrees - latitude) <= 0.75 &&
      Math.abs(item.longitudeDegrees - longitude) <= 1,
  );
}

function inRegion(
  aircraft: Aircraft,
  region: Extract<NonNullable<Monitor["targetContext"]>, { kind: "region" }>,
): boolean {
  const longitudeInside =
    region.west <= region.east
      ? aircraft.longitudeDegrees >= region.west && aircraft.longitudeDegrees <= region.east
      : aircraft.longitudeDegrees >= region.west || aircraft.longitudeDegrees <= region.east;
  return aircraft.latitudeDegrees >= region.south &&
    aircraft.latitudeDegrees <= region.north &&
    longitudeInside;
}

function matchesPattern(aircraft: Aircraft, field: string, expected: string): boolean {
  const actual =
    field === "icao24"
      ? aircraft.id
      : field === "registration"
        ? aircraft.registration ?? ""
        : field === "category"
          ? aircraft.category
          : field === "airline"
            ? aircraft.callsign ?? ""
            : "";
  return actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
}

function aircraftLabel(aircraft: Aircraft): string {
  return aircraft.callsign ?? aircraft.registration ?? aircraft.id.toUpperCase();
}
