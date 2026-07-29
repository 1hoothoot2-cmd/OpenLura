export const LOCAL_TEST_MODE_VALUE = "enabled";

export type LocalTestScenario =
  | "normal"
  | "empty"
  | "stale-cache"
  | "timeout"
  | "budget-exceeded"
  | "provider-unavailable";

const SCENARIOS = new Set<LocalTestScenario>([
  "normal",
  "empty",
  "stale-cache",
  "timeout",
  "budget-exceeded",
  "provider-unavailable",
]);

const state = globalThis as typeof globalThis & {
  __skytrackerLocalTestScenario?: LocalTestScenario;
};

export function isLocalTestEnvironment(): boolean {
  return (
    process.env.SKYTRACKER_LOCAL_TEST_MODE === LOCAL_TEST_MODE_VALUE &&
    process.env.NEXT_PUBLIC_SKYTRACKER_ENVIRONMENT === "local-test" &&
    process.env.SKYTRACKER_LOCAL_TEST_HOST === "127.0.0.1" &&
    !process.env.VERCEL &&
    !process.env.K_SERVICE &&
    !process.env.GOOGLE_CLOUD_PROJECT
  );
}

export function requireLocalTestEnvironment(): void {
  if (!isLocalTestEnvironment()) {
    throw new Error("Local test fixtures are disabled outside the local test environment.");
  }
}

export function getLocalTestScenario(): LocalTestScenario {
  requireLocalTestEnvironment();
  return state.__skytrackerLocalTestScenario ?? "normal";
}

export function setLocalTestScenario(value: unknown): LocalTestScenario {
  requireLocalTestEnvironment();
  if (typeof value !== "string" || !SCENARIOS.has(value as LocalTestScenario)) {
    throw new Error("Unsupported local test scenario.");
  }
  state.__skytrackerLocalTestScenario = value as LocalTestScenario;
  return state.__skytrackerLocalTestScenario;
}

export function resetLocalTestScenario(): void {
  if (isLocalTestEnvironment()) state.__skytrackerLocalTestScenario = "normal";
}
