export const MONITOR_KINDS = [
  "flight",
  "aircraft",
  "airport",
  "weather",
  "spotter",
  "news",
] as const;

export type MonitorKind = (typeof MONITOR_KINDS)[number];

export const MONITOR_TRIGGER_MODES = [
  "once",
  "continuous",
  "scheduled",
] as const;

export type MonitorTriggerMode = (typeof MONITOR_TRIGGER_MODES)[number];

export const MONITOR_STATUSES = [
  "active",
  "paused",
  "triggered",
  "completed",
  "expired",
  "disabled",
] as const;

export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export type MonitorConditionOperator =
  | "equals"
  | "contains"
  | "above"
  | "below"
  | "appears"
  | "changes-to";

export interface MonitorCondition {
  id: string;
  field: string;
  operator: MonitorConditionOperator;
  expectedValue?: string | number | boolean;
}

export interface MonitorRule {
  match: "all" | "any";
  conditions: readonly MonitorCondition[];
}

export interface MonitorTrigger {
  mode: MonitorTriggerMode;
  scheduledAtEpochMillis: number | null;
}

export interface MonitorState {
  status: MonitorStatus;
  evaluationCount: number;
  triggerCount: number;
  lastEvaluatedAtEpochMillis: number | null;
  lastTriggeredAtEpochMillis: number | null;
}

export interface MonitorTarget {
  stableId: string;
  label: string;
}

export type MonitorTargetContext =
  | Readonly<{ kind: "aircraft"; aircraftId: string }>
  | Readonly<{ kind: "airport"; icaoCode: string | null; latitude: number; longitude: number }>
  | Readonly<{
      kind: "region";
      south: number;
      west: number;
      north: number;
      east: number;
    }>
  | Readonly<{ kind: "pattern"; field: string; value: string }>;

export interface Monitor {
  id: string;
  ownerId: string | null;
  kind: MonitorKind;
  title: string;
  target: MonitorTarget;
  targetContext?: MonitorTargetContext;
  rule: MonitorRule;
  trigger: MonitorTrigger;
  state: MonitorState;
  createdAtEpochMillis: number;
  expiresAtEpochMillis: number | null;
}

export interface MonitorObservation {
  observedAtEpochMillis: number;
  values: Readonly<Record<string, unknown>>;
  source: "live-aircraft" | "airport" | "weather" | "news" | "manual";
}

export interface NotificationIntent {
  id: string;
  monitorId: string;
  title: string;
  message: string;
  createdAtEpochMillis: number;
  deliveryState: "not-requested";
}

export interface MonitorResult {
  monitor: Monitor;
  matched: boolean;
  notificationIntent: NotificationIntent | null;
  reason:
    | "matched"
    | "not-matched"
    | "not-active"
    | "not-due"
    | "expired";
}

export interface CreateMonitorInput {
  id: string;
  ownerId?: string | null;
  kind: MonitorKind;
  title: string;
  target: MonitorTarget;
  targetContext?: MonitorTargetContext;
  rule: MonitorRule;
  trigger: MonitorTrigger;
  createdAtEpochMillis: number;
  expiresAtEpochMillis?: number | null;
}

export function createMonitor(input: CreateMonitorInput): Monitor {
  const id = input.id.trim();
  const title = input.title.trim();
  const stableId = input.target.stableId.trim();
  const label = input.target.label.trim();

  if (!id || !title || !stableId || !label) {
    throw new Error("Monitor identity, title and target are required.");
  }

  if (!Number.isFinite(input.createdAtEpochMillis)) {
    throw new Error("Monitor creation time must be finite.");
  }

  if (input.rule.conditions.length === 0) {
    throw new Error("A monitor requires at least one condition.");
  }

  if (
    input.trigger.mode === "scheduled" &&
    (input.trigger.scheduledAtEpochMillis === null ||
      !Number.isFinite(input.trigger.scheduledAtEpochMillis))
  ) {
    throw new Error("A scheduled monitor requires a valid schedule.");
  }

  return {
    ...input,
    id,
    ownerId: input.ownerId ?? null,
    title,
    target: { stableId, label },
    targetContext: input.targetContext,
    rule: {
      match: input.rule.match,
      conditions: input.rule.conditions.map((condition) => ({
        ...condition,
        id: condition.id.trim(),
        field: condition.field.trim(),
      })),
    },
    state: {
      status: "active",
      evaluationCount: 0,
      triggerCount: 0,
      lastEvaluatedAtEpochMillis: null,
      lastTriggeredAtEpochMillis: null,
    },
    expiresAtEpochMillis: input.expiresAtEpochMillis ?? null,
  };
}
