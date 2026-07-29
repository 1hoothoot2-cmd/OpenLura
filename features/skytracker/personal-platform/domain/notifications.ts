export type AlertId = string;

export type AlertCondition = Readonly<{
  field: string;
  operator: "equals" | "contains" | "above" | "below" | "enters" | "leaves";
  value: string | number | boolean;
}>;

export type AlertTrigger = Readonly<{
  kind: "aircraft-update" | "airport-event" | "schedule";
  conditions: readonly AlertCondition[];
}>;

export type AlertSchedule =
  | Readonly<{ kind: "immediate" }>
  | Readonly<{
      kind: "window";
      timezone: string;
      startLocalTime: string;
      endLocalTime: string;
    }>;

export type AlertDestination =
  | Readonly<{ kind: "in-app" }>
  | Readonly<{ kind: "email"; addressReference: string }>
  | Readonly<{ kind: "push"; deviceReference: string }>;

export type Alert = Readonly<{
  id: AlertId;
  userId: string;
  enabled: boolean;
  trigger: AlertTrigger;
  schedule: AlertSchedule;
  destinations: readonly AlertDestination[];
}>;
