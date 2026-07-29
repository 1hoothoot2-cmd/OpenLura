export const ACCOUNT_TIERS = [
  "guest",
  "free",
  "account",
  "pro",
  "enterprise",
] as const;

export type AccountTier = (typeof ACCOUNT_TIERS)[number];

export function isAccountTier(value: unknown): value is AccountTier {
  return ACCOUNT_TIERS.includes(value as AccountTier);
}
