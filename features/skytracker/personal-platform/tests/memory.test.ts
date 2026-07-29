import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryManager } from "../application/memoryManager.ts";
import { createMemoryItem, deduplicateMemory, type MemoryItem } from "../domain/memory.ts";
import {
  DEFAULT_SKYGUIDE_AI_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
} from "../domain/preferences.ts";

function fixture() {
  let items: MemoryItem[] = [];
  let ai = DEFAULT_SKYGUIDE_AI_PREFERENCES;
  const memoryRepository = {
    listForUser: async () => items,
    save: async (item: MemoryItem) => { items = [...deduplicateMemory([...items, item])]; },
    remove: async (_userId: string, id: string) => {
      items = items.filter((item) => item.id !== id);
    },
  };
  const preferencesRepository = {
    getUserPreferences: async () => DEFAULT_USER_PREFERENCES,
    saveUserPreferences: async () => {},
    getAiPreferences: async () => ai,
    saveAiPreferences: async (_userId: string, value: typeof ai) => { ai = value; },
  };
  return {
    manager: new MemoryManager(memoryRepository, preferencesRepository),
    items: () => items,
    ai: () => ai,
  };
}

test("memory items normalize and deduplicate stable category identities", () => {
  const first = createMemoryItem({
    userId: "user-1", category: "favorite-aircraft", value: "  Airbus   A380 ",
    nowEpochMillis: 1,
  });
  const second = createMemoryItem({
    userId: "user-1", category: "favorite-aircraft", value: "airbus a380",
    nowEpochMillis: 2,
  });
  assert.equal(first.value, "Airbus A380");
  assert.equal(deduplicateMemory([first, second]).length, 1);
});

test("memory manager supports explicit add, remove and transparent reads", async () => {
  const state = fixture();
  const item = await state.manager.add("user-1", "spotting-interest", "Wide-body aircraft");
  assert.equal((await state.manager.get("user-1")).items.length, 1);
  const changed = await state.manager.update(
    "user-1",
    item.id,
    "spotting-interest",
    "Airport photography",
  );
  assert.equal((await state.manager.get("user-1")).items[0]?.value, "Airport photography");
  await state.manager.remove("user-1", changed.id);
  assert.equal((await state.manager.get("user-1")).items.length, 0);
});

test("memory manager changes AI profile only after an explicit command", async () => {
  const state = fixture();
  assert.equal(state.ai().expertiseLevel, "beginner");
  await state.manager.updateAiPreferences("user-1", "professional", "technical");
  assert.equal(state.ai().expertiseLevel, "professional");
  assert.equal(state.ai().conversationStyle, "technical");
});

test("clear memory resets AI preferences without touching favorites repositories", async () => {
  const state = fixture();
  await state.manager.add("user-1", "favorite-route", "EHAM-EGLL");
  await state.manager.updateAiPreferences("user-1", "professional", "technical");
  await state.manager.clear("user-1");
  assert.deepEqual(state.items(), []);
  assert.deepEqual(state.ai(), DEFAULT_SKYGUIDE_AI_PREFERENCES);
});

test("P4.3 migration creates only owned memory with CRUD privileges", () => {
  const migration = readFileSync(
    fileURLToPath(new URL(
      "../../../../supabase/migrations/20260729_skytracker_memory.sql",
      import.meta.url,
    )),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.skytracker_memory/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all .* from anon/);
  assert.match(migration, /grant select, insert, update, delete/);
  assert.equal((migration.match(/auth\.uid\(\)/g) ?? []).length, 5);
  assert.doesNotMatch(
    migration,
    /service_role|conversation_memory|chat_logs?|embedding/i,
  );
});

test("memory UI and route remain same-origin and require explicit clear confirmation", () => {
  const panel = readFileSync(
    fileURLToPath(new URL("../presentation/SkyGuideMemoryPanel.tsx", import.meta.url)),
    "utf8",
  );
  const route = readFileSync(
    fileURLToPath(new URL("../../../../app/api/skytracker/memory/route.ts", import.meta.url)),
    "utf8",
  );
  assert.match(panel, /\/api\/skytracker\/memory/);
  assert.match(panel, /Confirm clear/);
  assert.match(panel, /Favorites were not changed/);
  assert.doesNotMatch(panel, /supabase|service.role|NEXT_PUBLIC/i);
  assert.match(route, /requireOpenLuraIdentity/);
});
