import type {
  FavoritesRepository,
  MemoryRepository,
  PreferencesRepository,
  ProfileRepository,
} from "../application/repositories.ts";
import {
  EMPTY_PERSONAL_FAVORITES,
  normalizeFavorites,
  type PersonalFavorite,
  type PersonalFavorites,
} from "../domain/favorites.ts";
import { createGuestProfile, type UserProfile } from "../domain/profile.ts";
import type { MemoryCategory, MemoryItem } from "../domain/memory.ts";
import type {
  SkyGuideAiPreferences,
  UserPreferences,
} from "../domain/preferences.ts";

type SupabaseRepositoryConfig = Readonly<{
  baseUrl: string;
  anonKey: string;
  accessToken: string;
  fetcher?: typeof fetch;
}>;

type ProfileRow = Readonly<{
  user_id: string;
  display_name: string | null;
  language: string;
  timezone: string;
  distance_unit: "kilometers" | "nautical-miles";
  altitude_unit: "meters" | "feet";
  speed_unit: "meters-per-second" | "knots";
  theme: "system" | "dark";
  account_tier: "guest" | "free" | "account" | "pro" | "enterprise";
  ai_expertise_level: SkyGuideAiPreferences["expertiseLevel"];
  ai_conversation_style: SkyGuideAiPreferences["conversationStyle"];
  ai_interests: readonly string[];
  ai_favorite_topics: readonly string[];
}>;

type FavoriteRow = Readonly<{
  user_id: string;
  kind: PersonalFavorite["kind"];
  stable_id: string;
  label: string | null;
  added_at_epoch_millis: number;
}>;

type MemoryRow = Readonly<{
  user_id: string;
  category: MemoryCategory;
  value: string;
  label: string | null;
  created_at_epoch_millis: number;
  updated_at_epoch_millis: number;
}>;

export class SupabaseProfileRepository implements ProfileRepository {
  private readonly client: SupabaseRestClient;

  constructor(config: SupabaseRepositoryConfig) {
    this.client = new SupabaseRestClient(config);
  }

  async findByUserId(userId: string): Promise<UserProfile | null> {
    const rows = await this.client.request<readonly ProfileRow[]>(
      `/rest/v1/skytracker_profiles?user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    );
    const row = rows[0];
    return row ? profileFromRow(row) : null;
  }

  async save(profile: UserProfile): Promise<void> {
    await this.client.request("/rest/v1/skytracker_profiles?on_conflict=user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(profileToRow(profile)),
    });
  }
}

export class SupabaseFavoritesRepository implements FavoritesRepository {
  private readonly client: SupabaseRestClient;

  constructor(config: SupabaseRepositoryConfig) {
    this.client = new SupabaseRestClient(config);
  }

  async getForUser(userId: string): Promise<PersonalFavorites> {
    const rows = await this.client.request<readonly FavoriteRow[]>(
      `/rest/v1/skytracker_favorites?user_id=eq.${encodeURIComponent(userId)}&order=kind,stable_id`,
    );
    return groupFavorites(rows.map(favoriteFromRow));
  }

  async saveForUser(
    userId: string,
    favorites: PersonalFavorites,
  ): Promise<void> {
    const desired = normalizeFavorites([
      ...favorites.aircraft,
      ...favorites.airports,
      ...favorites.airlines,
      ...favorites.flights,
    ]);
    const existing = await this.getForUser(userId);
    const existingItems = [
      ...existing.aircraft,
      ...existing.airports,
      ...existing.airlines,
      ...existing.flights,
    ];
    const desiredKeys = new Set(
      desired.map((item) => `${item.kind}:${item.stableId.toLowerCase()}`),
    );
    for (const item of existingItems) {
      if (desiredKeys.has(`${item.kind}:${item.stableId.toLowerCase()}`)) {
        continue;
      }
      await this.client.request(
        `/rest/v1/skytracker_favorites?user_id=eq.${encodeURIComponent(userId)}&kind=eq.${item.kind}&stable_id=eq.${encodeURIComponent(item.stableId)}`,
        { method: "DELETE" },
      );
    }
    const records = desired.map((favorite) => favoriteToRow(userId, favorite));
    if (records.length === 0) return;
    await this.client.request(
      "/rest/v1/skytracker_favorites?on_conflict=user_id,kind,stable_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(records),
      },
    );
  }
}

export class SupabaseMemoryRepository implements MemoryRepository {
  private readonly client: SupabaseRestClient;

  constructor(config: SupabaseRepositoryConfig) {
    this.client = new SupabaseRestClient(config);
  }

  async listForUser(userId: string): Promise<readonly MemoryItem[]> {
    const rows = await this.client.request<readonly MemoryRow[]>(
      `/rest/v1/skytracker_memory?user_id=eq.${encodeURIComponent(userId)}&order=category,value&limit=100`,
    );
    return rows.map(memoryFromRow);
  }

  async save(record: MemoryItem): Promise<void> {
    await this.client.request(
      "/rest/v1/skytracker_memory?on_conflict=user_id,category,value",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(memoryToRow(record)),
      },
    );
  }

  async remove(userId: string, memoryId: string): Promise<void> {
    const separator = memoryId.indexOf(":");
    if (separator < 1) throw new Error("Invalid memory id");
    const category = memoryId.slice(0, separator);
    const value = memoryId.slice(separator + 1);
    await this.client.request(
      `/rest/v1/skytracker_memory?user_id=eq.${encodeURIComponent(userId)}&category=eq.${encodeURIComponent(category)}&value=eq.${encodeURIComponent(value)}`,
      { method: "DELETE" },
    );
  }
}

export class SupabasePreferencesRepository implements PreferencesRepository {
  private readonly profiles: SupabaseProfileRepository;

  constructor(config: SupabaseRepositoryConfig) {
    this.profiles = new SupabaseProfileRepository(config);
  }

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const profile = await this.profiles.findByUserId(userId);
    return profile ? {
      language: profile.language,
      timezone: profile.timezone,
      units: profile.preferredUnits,
      theme: profile.theme,
    } : null;
  }

  async saveUserPreferences(
    userId: string,
    preferences: UserPreferences,
  ): Promise<void> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new Error("Profile not found");
    await this.profiles.save({
      ...profile,
      language: preferences.language,
      timezone: preferences.timezone,
      preferredUnits: preferences.units,
      theme: preferences.theme,
    });
  }

  async getAiPreferences(userId: string): Promise<SkyGuideAiPreferences | null> {
    return (await this.profiles.findByUserId(userId))?.aiPreferences ?? null;
  }

  async saveAiPreferences(
    userId: string,
    preferences: SkyGuideAiPreferences,
  ): Promise<void> {
    const profile = await this.profiles.findByUserId(userId);
    if (!profile) throw new Error("Profile not found");
    await this.profiles.save({ ...profile, aiPreferences: preferences });
  }
}

export function createSupabaseRepositoryConfig(
  accessToken: string,
): SupabaseRepositoryConfig {
  const baseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    throw new Error("SkyTracker account storage is not configured");
  }
  return { baseUrl, anonKey, accessToken };
}

export async function ensureAccountProfile(
  repository: ProfileRepository,
  userId: string,
): Promise<UserProfile> {
  const existing = await repository.findByUserId(userId);
  if (existing) return existing;
  const profile = {
    ...createGuestProfile(userId),
    accountTier: "account" as const,
  };
  await repository.save(profile);
  return profile;
}

class SupabaseRestClient {
  private readonly baseUrl: string;
  private readonly anonKey: string;
  private readonly accessToken: string;
  private readonly fetcher: typeof fetch;

  constructor(config: SupabaseRepositoryConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.anonKey = config.anonKey;
    this.accessToken = config.accessToken;
    this.fetcher = config.fetcher ?? fetch;
  }

  async request<T = void>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.anonKey);
    headers.set("Authorization", `Bearer ${this.accessToken}`);
    headers.set("Accept", "application/json");
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`SkyTracker account storage returned ${response.status}`);
    }
    if (response.status === 204) return undefined as T;
    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) as T : undefined as T;
  }
}

function profileFromRow(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    language: row.language,
    timezone: row.timezone,
    preferredUnits: {
      distance: row.distance_unit,
      altitude: row.altitude_unit,
      speed: row.speed_unit,
    },
    theme: row.theme,
    favoriteAirlines: [],
    favoriteAirports: [],
    favoriteAircraft: [],
    spottingPreferences: {
      preferredLocations: [],
      preferredAircraftCategories: [],
    },
    aiPreferences: {
      interests: row.ai_interests ?? [],
      expertiseLevel: row.ai_expertise_level ?? "beginner",
      favoriteTopics: row.ai_favorite_topics ?? [],
      conversationStyle: row.ai_conversation_style ?? "concise",
    },
    notificationPreferences: {
      enabled: false,
      quietHoursTimezone: null,
    },
    accountTier: row.account_tier,
  };
}

function profileToRow(profile: UserProfile): ProfileRow {
  return {
    user_id: profile.userId,
    display_name: profile.displayName,
    language: profile.language,
    timezone: profile.timezone,
    distance_unit: profile.preferredUnits.distance,
    altitude_unit: profile.preferredUnits.altitude,
    speed_unit: profile.preferredUnits.speed,
    theme: profile.theme,
    account_tier: profile.accountTier,
    ai_expertise_level: profile.aiPreferences.expertiseLevel,
    ai_conversation_style: profile.aiPreferences.conversationStyle,
    ai_interests: profile.aiPreferences.interests,
    ai_favorite_topics: profile.aiPreferences.favoriteTopics,
  };
}

function memoryFromRow(row: MemoryRow): MemoryItem {
  return {
    id: `${row.category}:${row.value}`,
    userId: row.user_id,
    category: row.category,
    value: row.value,
    label: row.label,
    createdAtEpochMillis: row.created_at_epoch_millis,
    updatedAtEpochMillis: row.updated_at_epoch_millis,
  };
}

function memoryToRow(item: MemoryItem): MemoryRow {
  return {
    user_id: item.userId,
    category: item.category,
    value: item.value,
    label: item.label,
    created_at_epoch_millis: item.createdAtEpochMillis,
    updated_at_epoch_millis: item.updatedAtEpochMillis,
  };
}

function favoriteFromRow(row: FavoriteRow): PersonalFavorite {
  return {
    kind: row.kind,
    stableId: row.stable_id,
    label: row.label,
    addedAtEpochMillis: row.added_at_epoch_millis,
  };
}

function favoriteToRow(
  userId: string,
  favorite: PersonalFavorite,
): FavoriteRow {
  return {
    user_id: userId,
    kind: favorite.kind,
    stable_id: favorite.stableId,
    label: favorite.label,
    added_at_epoch_millis: favorite.addedAtEpochMillis,
  };
}

function groupFavorites(
  favorites: readonly PersonalFavorite[],
): PersonalFavorites {
  const normalized = normalizeFavorites(favorites);
  if (normalized.length === 0) return EMPTY_PERSONAL_FAVORITES;
  return {
    aircraft: normalized.filter((item) => item.kind === "aircraft"),
    airports: normalized.filter((item) => item.kind === "airport"),
    airlines: normalized.filter((item) => item.kind === "airline"),
    flights: normalized.filter((item) => item.kind === "flight"),
  };
}
