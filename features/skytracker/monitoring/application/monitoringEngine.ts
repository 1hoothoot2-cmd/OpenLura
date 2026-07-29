import type {
  Monitor,
  MonitorCondition,
  MonitorObservation,
  MonitorResult,
  MonitorStatus,
  NotificationIntent,
} from "../domain/monitoring.ts";

export interface MonitorRepository {
  list(ownerId: string): Promise<readonly Monitor[]>;
  findById(ownerId: string, monitorId: string): Promise<Monitor | null>;
  save(monitor: Monitor): Promise<void>;
  remove(ownerId: string, monitorId: string): Promise<void>;
}

export interface MonitoringEngine {
  evaluate(monitor: Monitor, observation: MonitorObservation): MonitorResult;
  transition(monitor: Monitor, status: MonitorStatus): Monitor;
}

export class DeterministicMonitoringEngine implements MonitoringEngine {
  evaluate(monitor: Monitor, observation: MonitorObservation): MonitorResult {
    if (
      monitor.expiresAtEpochMillis !== null &&
      observation.observedAtEpochMillis >= monitor.expiresAtEpochMillis
    ) {
      return result(
        this.transition(monitor, "expired"),
        false,
        null,
        "expired",
      );
    }

    if (!["active", "triggered"].includes(monitor.state.status)) {
      return result(monitor, false, null, "not-active");
    }

    if (
      monitor.trigger.mode === "scheduled" &&
      monitor.trigger.scheduledAtEpochMillis !== null &&
      observation.observedAtEpochMillis < monitor.trigger.scheduledAtEpochMillis
    ) {
      return result(monitor, false, null, "not-due");
    }

    const conditionResults = monitor.rule.conditions.map((condition) =>
      matchesCondition(condition, observation.values),
    );
    const matched =
      monitor.rule.match === "all"
        ? conditionResults.every(Boolean)
        : conditionResults.some(Boolean);

    const evaluated: Monitor = {
      ...monitor,
      state: {
        ...monitor.state,
        status:
          !matched &&
          monitor.trigger.mode === "continuous" &&
          monitor.state.status === "triggered"
            ? "active"
            : monitor.state.status,
        evaluationCount: monitor.state.evaluationCount + 1,
        lastEvaluatedAtEpochMillis: observation.observedAtEpochMillis,
      },
    };

    if (!matched) {
      return result(evaluated, false, null, "not-matched");
    }

    const status: MonitorStatus =
      monitor.trigger.mode === "continuous" ? "triggered" : "completed";
    const triggered: Monitor = {
      ...evaluated,
      state: {
        ...evaluated.state,
        status,
        triggerCount: evaluated.state.triggerCount + 1,
        lastTriggeredAtEpochMillis: observation.observedAtEpochMillis,
      },
    };

    return result(
      triggered,
      true,
      createNotificationIntent(triggered, observation.observedAtEpochMillis),
      "matched",
    );
  }

  transition(monitor: Monitor, status: MonitorStatus): Monitor {
    return {
      ...monitor,
      state: {
        ...monitor.state,
        status,
      },
    };
  }
}

function matchesCondition(
  condition: MonitorCondition,
  values: Readonly<Record<string, unknown>>,
): boolean {
  const actualValue = values[condition.field];

  switch (condition.operator) {
    case "appears":
      return actualValue !== undefined && actualValue !== null;
    case "equals":
    case "changes-to":
      return actualValue === condition.expectedValue;
    case "contains":
      return (
        typeof actualValue === "string" &&
        typeof condition.expectedValue === "string" &&
        actualValue
          .toLocaleLowerCase()
          .includes(condition.expectedValue.toLocaleLowerCase())
      );
    case "above":
      return (
        typeof actualValue === "number" &&
        typeof condition.expectedValue === "number" &&
        actualValue > condition.expectedValue
      );
    case "below":
      return (
        typeof actualValue === "number" &&
        typeof condition.expectedValue === "number" &&
        actualValue < condition.expectedValue
      );
  }
}

function createNotificationIntent(
  monitor: Monitor,
  createdAtEpochMillis: number,
): NotificationIntent {
  return {
    id: `${monitor.id}:${monitor.state.triggerCount}`,
    monitorId: monitor.id,
    title: monitor.title,
    message: `${monitor.target.label} matched the monitoring rule.`,
    createdAtEpochMillis,
    deliveryState: "not-requested",
  };
}

function result(
  monitor: Monitor,
  matched: boolean,
  notificationIntent: NotificationIntent | null,
  reason: MonitorResult["reason"],
): MonitorResult {
  return { monitor, matched, notificationIntent, reason };
}
