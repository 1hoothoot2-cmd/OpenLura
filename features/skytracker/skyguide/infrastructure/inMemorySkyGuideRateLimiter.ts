import type {
  SkyGuideAccessTier,
  SkyGuideRateLimiter,
} from "../application/skyGuideAssistant.ts";

const HOUR_MILLIS = 60 * 60 * 1_000;

export const SKYGUIDE_TIER_LIMITS: Readonly<Record<SkyGuideAccessTier, number>> = {
  free: 5,
  account: 20,
  pro: Number.MAX_SAFE_INTEGER,
};

export class InMemorySkyGuideRateLimiter implements SkyGuideRateLimiter {
  private readonly entries = new Map<string, { count: number; resetAt: number }>();

  consume(key: string, tier: SkyGuideAccessTier) {
    const now = Date.now();
    const limit = SKYGUIDE_TIER_LIMITS[tier];
    const current = this.entries.get(key);
    if (!current || current.resetAt <= now) {
      const resetAt = now + HOUR_MILLIS;
      this.entries.set(key, { count: 1, resetAt });
      return { allowed: true, limit, remaining: limit - 1, resetAtEpochMillis: resetAt };
    }
    if (current.count >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAtEpochMillis: current.resetAt,
      };
    }
    current.count += 1;
    return {
      allowed: true,
      limit,
      remaining: limit - current.count,
      resetAtEpochMillis: current.resetAt,
    };
  }
}
