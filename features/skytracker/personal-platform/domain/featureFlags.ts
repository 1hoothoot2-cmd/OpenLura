import type { AccountTier } from "./account.ts";

export const PERSONAL_FEATURES = [
  "skyguide-pro",
  "memory",
  "notifications",
  "weather-plus",
  "airport-plus",
  "monitoring",
] as const;

export type PersonalFeature = (typeof PERSONAL_FEATURES)[number];
export type FeatureOverrides = Readonly<Partial<Record<PersonalFeature, boolean>>>;

const DEFAULT_FEATURE_ACCESS: Readonly<
  Record<PersonalFeature, readonly AccountTier[]>
> = {
  "skyguide-pro": ["pro", "enterprise"],
  memory: ["account", "pro", "enterprise"],
  notifications: ["account", "pro", "enterprise"],
  "weather-plus": ["pro", "enterprise"],
  "airport-plus": ["pro", "enterprise"],
  monitoring: ["enterprise"],
};

export function isFeatureEnabled(
  feature: PersonalFeature,
  accountTier: AccountTier,
  overrides: FeatureOverrides = {},
): boolean {
  const override = overrides[feature];
  if (override !== undefined) return override;
  return DEFAULT_FEATURE_ACCESS[feature].includes(accountTier);
}
