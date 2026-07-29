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
import {
  mergeBrowserFavorites,
  toPersonalFavorites,
} from "../domain/accountSync.ts";
import {
  SupabaseFavoritesRepository,
  SupabaseProfileRepository,
  ensureAccountProfile,
} from "../infrastructure/supabaseRepositories.ts";
import {
  FAVORITES_STORAGE_VERSION,
} from "../../favorites/domain/favorites.ts";

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

  assert.doesNotMatch(
    repositorySource,
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

test("guest favorites migrate without overwriting richer local snapshots", () => {
  const local = {
    version: FAVORITES_STORAGE_VERSION,
    aircraft: [{
      aircraftId: "48455a",
      callsign: "KLM31K",
      registration: "PH-ABC",
    }],
    airports: [{
      icaoCode: "EHAM",
      iataCode: "AMS",
      name: "Amsterdam Airport Schiphol",
      city: "Amsterdam",
      countryCode: "NL",
      latitudeDegrees: 52.31,
      longitudeDegrees: 4.76,
    }],
  } as const;
  const migrated = toPersonalFavorites(local, 1_700_000_000_000);
  const merged = mergeBrowserFavorites(local, migrated);

  assert.equal(merged.aircraft.length, 1);
  assert.equal(merged.aircraft[0]?.registration, "PH-ABC");
  assert.equal(merged.airports[0]?.latitudeDegrees, 52.31);
});

test("Supabase repositories use the user token and never a service role", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    const body = String(url).includes("skytracker_profiles")
      ? []
      : [];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const config = {
    baseUrl: "https://example.supabase.co",
    anonKey: "public-anon",
    accessToken: "user-jwt",
    fetcher: fetcher as typeof fetch,
  };
  await new SupabaseProfileRepository(config).findByUserId("user-1");
  await new SupabaseFavoritesRepository(config).getForUser("user-1");

  assert.equal(requests.length, 2);
  for (const request of requests) {
    const headers = new Headers(request.init?.headers);
    assert.equal(headers.get("apikey"), "public-anon");
    assert.equal(headers.get("Authorization"), "Bearer user-jwt");
    assert.doesNotMatch(JSON.stringify(request), /service.role/i);
  }
});

test("profile creation is idempotent behind the repository port", async () => {
  const saved: string[] = [];
  const repository = {
    findByUserId: async () => null,
    save: async (profile: { userId: string }) => {
      saved.push(profile.userId);
    },
  };
  const profile = await ensureAccountProfile(repository, "user-1");
  assert.equal(profile.accountTier, "account");
  assert.deepEqual(saved, ["user-1"]);
});

test("RLS migration limits profiles and favorites to auth.uid", () => {
  const migration = readFileSync(
    fileURLToPath(
      new URL(
        "../../../../supabase/migrations/20260729_skytracker_personal_platform.sql",
        import.meta.url,
      ),
    ),
    "utf8",
  );
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /revoke all .* from anon/g);
  assert.equal((migration.match(/auth\.uid\(\)/g) ?? []).length, 10);
  assert.doesNotMatch(migration, /memory|subscription|notification/i);
});

test("account UI uses same-origin routes without direct Supabase access", () => {
  const component = readFileSync(
    fileURLToPath(
      new URL("../presentation/SkyTrackerAccountControl.tsx", import.meta.url),
    ),
    "utf8",
  );
  assert.match(component, /fetch\("\/api\/auth"/);
  assert.match(component, /fetch\("\/api\/skytracker\/account"/);
  assert.doesNotMatch(component, /supabase|service.role|NEXT_PUBLIC/i);
  assert.match(component, /Guest Mode/);
  assert.match(component, /Account active/);
});

test("authentication and account routes keep sessions server-side", () => {
  const authRoute = readFileSync(
    fileURLToPath(
      new URL("../../../../app/api/auth/route.ts", import.meta.url),
    ),
    "utf8",
  );
  const accountRoute = readFileSync(
    fileURLToPath(
      new URL("../../../../app/api/skytracker/account/route.ts", import.meta.url),
    ),
    "utf8",
  );

  assert.match(authRoute, /httpOnly:\s*true/);
  assert.match(authRoute, /sameSite:\s*"lax"/);
  assert.match(authRoute, /secure:\s*isProduction/);
  assert.match(authRoute, /action\s*===\s*"signup"/);
  assert.match(authRoute, /export async function GET/);
  assert.match(authRoute, /export async function DELETE/);
  assert.match(accountRoute, /requireOpenLuraIdentity/);
  assert.doesNotMatch(accountRoute, /SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC/);
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
