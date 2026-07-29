import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ACCOUNT_TIERS, isAccountTier } from "../domain/account.ts";
import {
  favoriteKey,
  normalizeFavorites,
  type PersonalFavorite,
} from "../domain/favorites.ts";
import {
  PERSONAL_FEATURES,
  isFeatureEnabled,
} from "../domain/featureFlags.ts";
import { createGuestProfile } from "../domain/profile.ts";
import {
  DEFAULT_SKYGUIDE_AI_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
} from "../domain/preferences.ts";

test("profile model starts with explicit guest defaults and independent lists", () => {
  const first = createGuestProfile(" guest-1 ");
  const second = createGuestProfile("guest-2");

  assert.equal(first.userId, "guest-1");
  assert.equal(first.accountTier, "guest");
  assert.deepEqual(first.preferredUnits, DEFAULT_USER_PREFERENCES.units);
  assert.deepEqual(first.aiPreferences, DEFAULT_SKYGUIDE_AI_PREFERENCES);
  assert.notEqual(first.favoriteAircraft, second.favoriteAircraft);
  assert.throws(() => createGuestProfile(" "));
});

test("account tiers are complete and reject unknown values", () => {
  assert.deepEqual(ACCOUNT_TIERS, [
    "guest",
    "free",
    "account",
    "pro",
    "enterprise",
  ]);
  assert.equal(isAccountTier("pro"), true);
  assert.equal(isAccountTier("premium"), false);
});

test("feature access is centralized, deterministic and overrideable", () => {
  assert.equal(PERSONAL_FEATURES.length, 6);
  assert.equal(isFeatureEnabled("memory", "guest"), false);
  assert.equal(isFeatureEnabled("memory", "account"), true);
  assert.equal(isFeatureEnabled("skyguide-pro", "pro"), true);
  assert.equal(isFeatureEnabled("monitoring", "pro"), false);
  assert.equal(
    isFeatureEnabled("monitoring", "guest", { monitoring: true }),
    true,
  );
});

test("favorites cover all planned kinds and deduplicate by stable identity", () => {
  const items: PersonalFavorite[] = [
    favorite("aircraft", "48455A"),
    favorite("aircraft", "48455a"),
    favorite("airport", "EHAM"),
    favorite("airline", "KLM"),
    favorite("flight", "KLM31K"),
  ];
  const normalized = normalizeFavorites(items);

  assert.equal(normalized.length, 4);
  assert.deepEqual(
    normalized.map((item) => item.kind),
    ["aircraft", "airline", "airport", "flight"],
  );
  assert.equal(favoriteKey(items[0]!), "aircraft:48455a");
});

test("settings and SkyGuide profile defaults remain provider neutral", () => {
  assert.equal(DEFAULT_USER_PREFERENCES.language, "en");
  assert.equal(DEFAULT_USER_PREFERENCES.timezone, "UTC");
  assert.equal(DEFAULT_USER_PREFERENCES.theme, "system");
  assert.equal(DEFAULT_SKYGUIDE_AI_PREFERENCES.conversationStyle, "concise");
});

test("repository boundary contains no concrete storage or cloud dependency", () => {
  const repositorySource = readFileSync(
    fileURLToPath(new URL("../application/repositories.ts", import.meta.url)),
    "utf8",
  );
  const platformIndex = readFileSync(
    fileURLToPath(new URL("../index.ts", import.meta.url)),
    "utf8",
  );

  assert.doesNotMatch(
    `${repositorySource}\n${platformIndex}`,
    /supabase|localStorage|sessionStorage|indexedDB|fetch\(|new\s+\w+Repository/i,
  );
  for (const name of [
    "ProfileRepository",
    "MemoryRepository",
    "PreferencesRepository",
    "FavoritesRepository",
    "NotificationRepository",
    "SubscriptionRepository",
  ]) {
    assert.match(repositorySource, new RegExp(`interface ${name}`));
  }
});

function favorite(
  kind: PersonalFavorite["kind"],
  stableId: string,
): PersonalFavorite {
  return {
    kind,
    stableId,
    label: null,
    addedAtEpochMillis: 1_700_000_000_000,
  };
}
