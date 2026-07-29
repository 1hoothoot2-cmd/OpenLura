import type { AccountTier } from "../domain/account.ts";
import type { PersonalFavorites } from "../domain/favorites.ts";
import type { Alert, AlertId } from "../domain/notifications.ts";
import type { UserProfile } from "../domain/profile.ts";
import type {
  SkyGuideAiPreferences,
  UserPreferences,
} from "../domain/preferences.ts";
import type { MemoryItem } from "../domain/memory.ts";

export interface ProfileRepository {
  findByUserId(userId: string): Promise<UserProfile | null>;
  save(profile: UserProfile): Promise<void>;
}

export interface MemoryRepository {
  listForUser(userId: string): Promise<readonly MemoryItem[]>;
  save(record: MemoryItem): Promise<void>;
  remove(userId: string, memoryId: string): Promise<void>;
}

export interface PreferencesRepository {
  getUserPreferences(userId: string): Promise<UserPreferences | null>;
  saveUserPreferences(userId: string, preferences: UserPreferences): Promise<void>;
  getAiPreferences(userId: string): Promise<SkyGuideAiPreferences | null>;
  saveAiPreferences(
    userId: string,
    preferences: SkyGuideAiPreferences,
  ): Promise<void>;
}

export interface FavoritesRepository {
  getForUser(userId: string): Promise<PersonalFavorites>;
  saveForUser(userId: string, favorites: PersonalFavorites): Promise<void>;
}

export interface NotificationRepository {
  listForUser(userId: string): Promise<readonly Alert[]>;
  save(alert: Alert): Promise<void>;
  remove(userId: string, alertId: AlertId): Promise<void>;
}

export interface SubscriptionState {
  readonly accountTier: AccountTier;
  readonly validUntilEpochMillis: number | null;
}

export interface SubscriptionRepository {
  getForUser(userId: string): Promise<SubscriptionState | null>;
}
