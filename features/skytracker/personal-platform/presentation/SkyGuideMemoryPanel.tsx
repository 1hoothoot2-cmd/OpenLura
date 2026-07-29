"use client";

import { useEffect, useState } from "react";
import type { MemoryCategory, SkyGuideMemory } from "../domain/memory";

const CATEGORY_LABELS = {
  "favorite-aircraft": "Aircraft",
  "favorite-airline": "Airlines",
  "favorite-airport": "Airports",
  "favorite-route": "Routes",
  "spotting-interest": "Spotting",
} as const;

export function SkyGuideMemoryPanel({ onClose }: { onClose: () => void }) {
  const [memory, setMemory] = useState<SkyGuideMemory | null>(null);
  const [message, setMessage] = useState("Loading memory…");
  const [confirmClear, setConfirmClear] = useState(false);
  const [newCategory, setNewCategory] = useState<MemoryCategory>("spotting-interest");
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/skytracker/memory", {
      credentials: "same-origin",
      cache: "no-store",
    }).then(async (response) => {
      if (!active) return;
      if (!response.ok) {
        setMessage("Memory is temporarily unavailable.");
        return;
      }
      const result = await response.json() as { memory: SkyGuideMemory };
      if (active) {
        setMemory(result.memory);
        setMessage("");
      }
    }).catch(() => {
      if (active) setMessage("Memory is temporarily unavailable.");
    });
    return () => {
      active = false;
    };
  }, []);

  async function updatePreferences(
    expertiseLevel: SkyGuideMemory["expertiseLevel"],
    conversationStyle: SkyGuideMemory["conversationStyle"],
  ) {
    const response = await fetch("/api/skytracker/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ expertiseLevel, conversationStyle }),
    });
    if (response.ok) {
      const result = await response.json() as { memory: SkyGuideMemory };
      setMemory(result.memory);
      setMessage("AI preferences updated.");
    }
  }

  async function addMemory() {
    if (!newValue.trim()) return;
    const response = await fetch("/api/skytracker/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ category: newCategory, value: newValue }),
    });
    if (response.ok) {
      const result = await response.json() as { memory: SkyGuideMemory };
      setMemory(result.memory);
      setNewValue("");
      setMessage("Memory item added.");
    }
  }

  async function updateUserPreferences(
    language: string,
    preferredUnits: SkyGuideMemory["preferredUnits"],
  ) {
    const response = await fetch("/api/skytracker/memory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ language, preferredUnits }),
    });
    if (response.ok) {
      const result = await response.json() as { memory: SkyGuideMemory };
      setMemory(result.memory);
      setMessage("Language and units updated.");
    }
  }

  async function remove(id: string) {
    const response = await fetch(
      `/api/skytracker/memory?id=${encodeURIComponent(id)}`,
      { method: "DELETE", credentials: "same-origin" },
    );
    if (response.ok) {
      const result = await response.json() as { memory: SkyGuideMemory };
      setMemory(result.memory);
      setMessage("Memory item removed.");
    }
  }

  async function clearMemory() {
    const response = await fetch("/api/skytracker/memory?scope=memory", {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (response.ok) {
      const result = await response.json() as { memory: SkyGuideMemory };
      setMemory(result.memory);
      setConfirmClear(false);
      setMessage("SkyGuide memory cleared. Favorites were not changed.");
    }
  }

  return (
    <section aria-label="SkyGuide Memory" className="max-h-[70vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-cyan-100/48">
            Personalization
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white/90">SkyGuide Memory</h2>
          <p className="mt-1 text-xs leading-5 text-white/48">
            Only aviation preferences you explicitly approve are stored.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Memory"
          className="min-h-9 min-w-9 rounded-lg text-white/58 hover:bg-white/[0.06]">
          ×
        </button>
      </div>

      {message && <p role="status" className="mt-3 text-xs text-cyan-100/65">{message}</p>}
      {memory && (
        <>
          <section className="mt-4 rounded-xl border border-cyan-200/12 p-3">
            <h3 className="text-xs font-semibold text-white/72">Add aviation memory</h3>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <select value={newCategory}
                aria-label="Memory category"
                onChange={(event) => setNewCategory(event.target.value as MemoryCategory)}
                className="min-h-10 rounded-lg border border-white/10 bg-[#0b1822] px-2 text-xs text-white">
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button type="button" onClick={() => void addMemory()}
                disabled={!newValue.trim()}
                className="min-h-10 rounded-lg bg-cyan-300 px-3 text-xs font-semibold text-[#03111a] disabled:opacity-40">
                Add
              </button>
              <input value={newValue} onChange={(event) => setNewValue(event.target.value)}
                placeholder="Airline, aircraft, airport, route or interest"
                aria-label="Memory value"
                className="col-span-2 min-h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-xs text-white outline-none focus:border-cyan-200/30" />
            </div>
          </section>

          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map(
            (category) => {
              const items = memory.items.filter((item) => item.category === category);
              return (
                <section key={category} className="mt-4 border-t border-white/[0.07] pt-3">
                  <h3 className="text-xs font-semibold text-white/72">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  {items.length === 0 ? (
                    <p className="mt-1 text-xs text-white/35">Nothing saved.</p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {items.map((item) => (
                        <li key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-3 py-2">
                          <span className="min-w-0 truncate text-xs text-white/68">
                            {item.label ?? item.value}
                          </span>
                          <button type="button" onClick={() => void remove(item.id)}
                            aria-label={`Remove ${item.label ?? item.value} from Memory`}
                            className="min-h-9 rounded-lg px-2 text-xs text-amber-100/72 hover:bg-amber-100/[0.07]">
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            },
          )}

          <section className="mt-4 border-t border-white/[0.07] pt-3">
            <h3 className="text-xs font-semibold text-white/72">AI Preferences</h3>
            <label className="mt-2 block text-xs text-white/48">
              Preferred language
              <input value={memory.preferredLanguage}
                onChange={(event) => setMemory({ ...memory, preferredLanguage: event.target.value })}
                onBlur={() => void updateUserPreferences(
                  memory.preferredLanguage,
                  memory.preferredUnits,
                )}
                className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#0b1822] px-2 text-white" />
            </label>
            <label className="mt-2 block text-xs text-white/48">
              Aviation units
              <select value={memory.preferredUnits.altitude === "feet" ? "aviation" : "metric"}
                onChange={(event) => void updateUserPreferences(
                  memory.preferredLanguage,
                  event.target.value === "aviation"
                    ? { distance: "nautical-miles", altitude: "feet", speed: "knots" }
                    : { distance: "kilometers", altitude: "meters", speed: "meters-per-second" },
                )}
                className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#0b1822] px-2 text-white">
                <option value="metric">Metric</option>
                <option value="aviation">Aviation (NM, ft, kt)</option>
              </select>
            </label>
            <label className="mt-2 block text-xs text-white/48">
              Expertise level
              <select value={memory.expertiseLevel}
                onChange={(event) => void updatePreferences(
                  event.target.value as SkyGuideMemory["expertiseLevel"],
                  memory.conversationStyle,
                )}
                className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#0b1822] px-2 text-white">
                <option value="beginner">Beginner</option>
                <option value="enthusiast">Enthusiast</option>
                <option value="professional">Expert</option>
              </select>
            </label>
            <label className="mt-2 block text-xs text-white/48">
              Conversation style
              <select value={memory.conversationStyle}
                onChange={(event) => void updatePreferences(
                  memory.expertiseLevel,
                  event.target.value as SkyGuideMemory["conversationStyle"],
                )}
                className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-[#0b1822] px-2 text-white">
                <option value="concise">Compact</option>
                <option value="balanced">Balanced</option>
                <option value="technical">Detailed</option>
              </select>
            </label>
          </section>

          <section className="mt-5 border-t border-white/[0.07] pt-3">
            {!confirmClear ? (
              <button type="button" onClick={() => setConfirmClear(true)}
                className="min-h-10 w-full rounded-xl border border-red-200/15 text-xs text-red-100/70">
                Clear Memory
              </button>
            ) : (
              <div role="alert" className="rounded-xl border border-red-200/15 p-3">
                <p className="text-xs leading-5 text-white/62">
                  Clear AI preferences and interests? Aircraft and airport favorites remain.
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => void clearMemory()}
                    className="min-h-9 flex-1 rounded-lg bg-red-200/15 text-xs text-red-50">
                    Confirm clear
                  </button>
                  <button type="button" onClick={() => setConfirmClear(false)}
                    className="min-h-9 flex-1 rounded-lg border border-white/10 text-xs text-white/65">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
