import type {
  AviationExpertise,
  ConversationStyle,
  PreferredUnits,
} from "./preferences.ts";

export const MEMORY_CATEGORIES = [
  "favorite-airline",
  "favorite-aircraft",
  "favorite-airport",
  "favorite-route",
  "spotting-interest",
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export type MemoryItem = Readonly<{
  id: string;
  userId: string;
  category: MemoryCategory;
  value: string;
  label: string | null;
  createdAtEpochMillis: number;
  updatedAtEpochMillis: number;
}>;

export type SkyGuideMemory = Readonly<{
  items: readonly MemoryItem[];
  preferredLanguage: string;
  preferredUnits: PreferredUnits;
  expertiseLevel: AviationExpertise;
  conversationStyle: ConversationStyle;
}>;

export type MemorySuggestion = Readonly<{
  category: MemoryCategory;
  value: string;
  label: string;
}>;

export function normalizeMemoryValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

export function createMemoryItem(input: {
  userId: string;
  category: MemoryCategory;
  value: string;
  label?: string | null;
  nowEpochMillis?: number;
}): MemoryItem {
  const userId = input.userId.trim();
  const value = normalizeMemoryValue(input.value);
  if (!userId || !value) throw new Error("Memory requires a user and value");
  const now = input.nowEpochMillis ?? Date.now();
  return {
    id: `${input.category}:${value}`,
    userId,
    category: input.category,
    value,
    label: input.label?.trim().slice(0, 160) || null,
    createdAtEpochMillis: now,
    updatedAtEpochMillis: now,
  };
}

export function deduplicateMemory(items: readonly MemoryItem[]): readonly MemoryItem[] {
  return [...new Map(
    items.map((item) => [
      `${item.category}:${normalizeMemoryValue(item.value).toLocaleLowerCase("en")}`,
      item,
    ]),
  ).values()].sort((left, right) =>
    left.category.localeCompare(right.category) || left.value.localeCompare(right.value)
  );
}
