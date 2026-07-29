import type { MemoryRepository, PreferencesRepository } from "./repositories.ts";
import {
  createMemoryItem,
  deduplicateMemory,
  type MemoryCategory,
  type MemoryItem,
  type SkyGuideMemory,
} from "../domain/memory.ts";
import {
  DEFAULT_SKYGUIDE_AI_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
  type AviationExpertise,
  type ConversationStyle,
} from "../domain/preferences.ts";

export class MemoryManager {
  private readonly memoryRepository: MemoryRepository;
  private readonly preferencesRepository: PreferencesRepository;

  constructor(
    memoryRepository: MemoryRepository,
    preferencesRepository: PreferencesRepository,
  ) {
    this.memoryRepository = memoryRepository;
    this.preferencesRepository = preferencesRepository;
  }

  async get(userId: string): Promise<SkyGuideMemory> {
    const [items, preferences, aiPreferences] = await Promise.all([
      this.memoryRepository.listForUser(userId),
      this.preferencesRepository.getUserPreferences(userId),
      this.preferencesRepository.getAiPreferences(userId),
    ]);
    return {
      items: deduplicateMemory(items),
      preferredLanguage: preferences?.language ?? DEFAULT_USER_PREFERENCES.language,
      preferredUnits: preferences?.units ?? DEFAULT_USER_PREFERENCES.units,
      expertiseLevel:
        aiPreferences?.expertiseLevel ??
        DEFAULT_SKYGUIDE_AI_PREFERENCES.expertiseLevel,
      conversationStyle:
        aiPreferences?.conversationStyle ??
        DEFAULT_SKYGUIDE_AI_PREFERENCES.conversationStyle,
    };
  }

  async add(
    userId: string,
    category: MemoryCategory,
    value: string,
    label?: string | null,
  ): Promise<MemoryItem> {
    const existing = await this.memoryRepository.listForUser(userId);
    if (
      existing.length >= 100 &&
      !existing.some((item) =>
        item.category === category &&
        item.value.toLocaleLowerCase("en") === value.trim().toLocaleLowerCase("en")
      )
    ) throw new Error("Memory limit reached");
    const item = createMemoryItem({ userId, category, value, label });
    await this.memoryRepository.save(item);
    return item;
  }

  async update(
    userId: string,
    memoryId: string,
    category: MemoryCategory,
    value: string,
    label?: string | null,
  ): Promise<MemoryItem> {
    const replacement = createMemoryItem({ userId, category, value, label });
    await this.memoryRepository.remove(userId, memoryId);
    await this.memoryRepository.save(replacement);
    return replacement;
  }

  async remove(userId: string, memoryId: string): Promise<void> {
    await this.memoryRepository.remove(userId, memoryId);
  }

  async updateAiPreferences(
    userId: string,
    expertiseLevel: AviationExpertise,
    conversationStyle: ConversationStyle,
  ): Promise<void> {
    const current =
      await this.preferencesRepository.getAiPreferences(userId) ??
      DEFAULT_SKYGUIDE_AI_PREFERENCES;
    await this.preferencesRepository.saveAiPreferences(userId, {
      ...current,
      expertiseLevel,
      conversationStyle,
    });
  }

  async updateUserPreferences(
    userId: string,
    language: string,
    preferredUnits: SkyGuideMemory["preferredUnits"],
  ): Promise<void> {
    const current =
      await this.preferencesRepository.getUserPreferences(userId) ??
      DEFAULT_USER_PREFERENCES;
    await this.preferencesRepository.saveUserPreferences(userId, {
      ...current,
      language: language.trim().slice(0, 35) || current.language,
      units: preferredUnits,
    });
  }

  async clear(userId: string): Promise<void> {
    const items = await this.memoryRepository.listForUser(userId);
    await Promise.all(items.map((item) => this.memoryRepository.remove(userId, item.id)));
    await this.preferencesRepository.saveAiPreferences(
      userId,
      DEFAULT_SKYGUIDE_AI_PREFERENCES,
    );
  }
}
