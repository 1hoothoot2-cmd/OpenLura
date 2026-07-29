export type DistanceUnit = "kilometers" | "nautical-miles";
export type AltitudeUnit = "meters" | "feet";
export type SpeedUnit = "meters-per-second" | "knots";
export type ThemePreference = "system" | "dark";
export type AviationExpertise = "beginner" | "enthusiast" | "professional";
export type ConversationStyle = "concise" | "balanced" | "technical";

export type PreferredUnits = Readonly<{
  distance: DistanceUnit;
  altitude: AltitudeUnit;
  speed: SpeedUnit;
}>;

export type UserPreferences = Readonly<{
  language: string;
  timezone: string;
  units: PreferredUnits;
  theme: ThemePreference;
}>;

export type SkyGuideAiPreferences = Readonly<{
  interests: readonly string[];
  expertiseLevel: AviationExpertise;
  favoriteTopics: readonly string[];
  conversationStyle: ConversationStyle;
}>;

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: "en",
  timezone: "UTC",
  units: {
    distance: "kilometers",
    altitude: "meters",
    speed: "meters-per-second",
  },
  theme: "system",
};

export const DEFAULT_SKYGUIDE_AI_PREFERENCES: SkyGuideAiPreferences = {
  interests: [],
  expertiseLevel: "beginner",
  favoriteTopics: [],
  conversationStyle: "concise",
};
