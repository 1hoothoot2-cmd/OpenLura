import type { AccountTier } from "./account.ts";
import {
  DEFAULT_SKYGUIDE_AI_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  type PreferredUnits,
  type SkyGuideAiPreferences,
  type ThemePreference,
  type UserPreferences,
} from "./preferences.ts";

export type SpottingPreferences = Readonly<{
  preferredLocations: readonly string[];
  preferredAircraftCategories: readonly string[];
}>;

export type NotificationPreferences = Readonly<{
  enabled: boolean;
  quietHoursTimezone: string | null;
}>;

export type UserProfile = Readonly<{
  userId: string;
  displayName: string | null;
  language: string;
  timezone: string;
  preferredUnits: PreferredUnits;
  theme: ThemePreference;
  favoriteAirlines: readonly string[];
  favoriteAirports: readonly string[];
  favoriteAircraft: readonly string[];
  spottingPreferences: SpottingPreferences;
  aiPreferences: SkyGuideAiPreferences;
  notificationPreferences: NotificationPreferences;
  accountTier: AccountTier;
}>;

export function createGuestProfile(
  userId: string,
  preferences: UserPreferences = DEFAULT_USER_PREFERENCES,
): UserProfile {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error("A profile requires a userId");

  return {
    userId: normalizedUserId,
    displayName: null,
    language: preferences.language,
    timezone: preferences.timezone,
    preferredUnits: preferences.units,
    theme: preferences.theme,
    favoriteAirlines: [],
    favoriteAirports: [],
    favoriteAircraft: [],
    spottingPreferences: {
      preferredLocations: [],
      preferredAircraftCategories: [],
    },
    aiPreferences: DEFAULT_SKYGUIDE_AI_PREFERENCES,
    notificationPreferences: {
      enabled: false,
      quietHoursTimezone: null,
    },
    accountTier: "guest",
  };
}
