"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgendaItem {
  id: string;
  time: string;
  title: string;
  done: boolean;
  color: "blue" | "purple" | "green" | "amber";
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const AGENDA_KEY = "openlura_dashboard_agenda";

function loadAgenda(): AgendaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AGENDA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAgenda(items: AgendaItem[]) {
  try {
    localStorage.setItem(AGENDA_KEY, JSON.stringify(items));
  } catch {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNow() {
  return new Date();
}

function formatDate(d: Date) {
  return d.toLocaleDateString("nl-NL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const COLOR_RING: Record<AgendaItem["color"], string> = {
  blue:   "ring-[#3b82f6]/50",
  purple: "ring-purple-400/50",
  green:  "ring-emerald-400/50",
  amber:  "ring-amber-400/50",
};

const COLOR_DOT: Record<AgendaItem["color"], string> = {
  blue:   "bg-[#3b82f6]",
  purple: "bg-purple-400",
  green:  "bg-emerald-400",
  amber:  "bg-amber-400",
};

const COLOR_TEXT: Record<AgendaItem["color"], string> = {
  blue:   "text-[#93c5fd]",
  purple: "text-purple-300",
  green:  "text-emerald-300",
  amber:  "text-amber-300",
};

const COLOR_BG: Record<AgendaItem["color"], string> = {
  blue:   "bg-[#3b82f6]/10 border-[#3b82f6]/20",
  purple: "bg-purple-400/10 border-purple-400/20",
  green:  "bg-emerald-400/10 border-emerald-400/20",
  amber:  "bg-amber-400/10 border-amber-400/20",
};

const COLORS: AgendaItem["color"][] = ["blue", "purple", "green", "amber"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PersonalDashboardPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  const [now, setNow] = useState(getNow());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newColor, setNewColor] = useState<AgendaItem["color"]>("blue");
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function check() {
      try {
        await fetch("/api/auth?action=refresh", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        }).catch(() => null);

        const res = await fetch("/api/auth", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);

        if (data?.authenticated) {
          setAuthed(true);
          const stateRes = await fetch("/api/personal-state", {
            method: "GET",
            credentials: "same-origin",
            headers: { "x-openlura-personal-env": "true" },
            cache: "no-store",
          }).catch(() => null);
          if (stateRes?.ok) {
            const stateData = await stateRes.json().catch(() => null);
            const name = stateData?.profile?.name || stateData?.state?.profile?.name;
            if (name) setUserName(name);
          }
        } else {
          router.replace("/login");
        }
      } catch {
        router.replace("/login");
      } finally {
        setAuthChecked(true);
      }
    }
    check();
  }, [router]);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(getNow()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Agenda ────────────────────────────────────────────────────────────────
  useEffect(() => {
    setItems(loadAgenda());
  }, []);

  useEffect(() => {
    saveAgenda(items);
  }, [items]);

  useEffect(() => {
    if (addOpen) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [addOpen]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addItem = () => {
    const title = newTitle.trim();
    if (!title) return;
    const item: AgendaItem = {
      id: `${Date.now()}-${Math.random()}`,
      time: newTime,
      title,
      done: false,
      color: newColor,
    };
    setItems(prev =>
      [...prev, item].sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      })
    );
    setNewTitle("");
    setNewTime("");
    setNewColor("blue");
    setAddOpen(false);
  };

  const toggleDone = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
          <p className="text-xs text-white/30">Laden...</p>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  const openItems = items.filter(i => !i.done);
  const doneItems = items.filter(i => i.done);
  const sortedItems = [...openItems, ...doneItems];

  const hours = now.getHours();
  const greeting =
    hours < 6  ? "Goedenacht" :
    hours < 12 ? "Goedemorgen" :
    hours < 18 ? "Goedemiddag" :
                 "Goedenavond";

  return (
    <div className="min-h-screen bg-[#050510] text-white selection:bg-[#3b82f6]/30">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[#1d4ed8]/6 blur-[140px]" />
        <div className="absolute top-1/2 -right-40 h-[400px] w-[400px] rounded-full bg-purple-600/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[500px] rounded-full bg-[#3b82f6]/4 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/6 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-[#3b82f6]/18 bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] shadow-[0_8px_20px_rgba(59,130,246,0.28)]">
            <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/90">OpenLura</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/32">Personal Dashboard</div>
          </div>
        </div>

        <a
          href="/personal-workspace"
          className="flex items-center gap-2 rounded-full border border-[#3b82f6]/22 bg-[#3b82f6]/10 px-4 py-2 text-sm text-[#93c5fd] backdrop-blur-xl transition-all duration-200 hover:border-[#3b82f6]/40 hover:bg-[#3b82f6]/18 hover:text-white hover:shadow-[0_8px_20px_rgba(59,130,246,0.18)] active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>Open chat</span>
        </a>
      </header>

      {/* Main */}
      <main className="relative z-10 mx-auto max-w-2xl px-4 py-10">

        {/* Greeting */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.18em] text-white/28 mb-1">{greeting}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white/92">
            {userName ? `${userName} 👋` : "Dashboard 👋"}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="capitalize text-sm text-white/42">{formatDate(now)}</span>
            <span className="h-1 w-1 rounded-full bg-white/20" />
            <span className="font-mono text-base tabular-nums text-[#3b82f6]/70 tracking-tight">
              {formatTime(now)}
            </span>
          </div>
        </div>

        {/* Agenda card */}
        <div className="rounded-[28px] border border-white/8 bg-white/[0.028] backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.20)]">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/6">
            <div>
              <h2 className="text-base font-semibold text-white/88">Agenda vandaag</h2>
              <p className="mt-0.5 text-xs text-white/32">
                {openItems.length === 0
                  ? "Alles gedaan 🎉"
                  : `${openItems.length} open · ${doneItems.length} afgerond`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(v => !v)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-200 active:scale-95 ${
                addOpen
                  ? "border-[#3b82f6]/30 bg-[#3b82f6]/14 text-[#93c5fd]"
                  : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/16 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-200 ${addOpen ? "rotate-45" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Add form */}
          {addOpen && (
            <div className="px-6 py-4 border-b border-white/6 bg-white/[0.02]">
              <div className="flex flex-col gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") addItem();
                    if (e.key === "Escape") setAddOpen(false);
                  }}
                  placeholder="Wat staat er op de planning?"
                  className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/24 focus:border-[#3b82f6]/28 transition-colors"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="time"
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/70 outline-none focus:border-[#3b82f6]/28 [color-scheme:dark] transition-colors"
                  />
                  <div className="flex items-center gap-1.5">
                    {COLORS.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={`h-5 w-5 rounded-full transition-all duration-150 ${COLOR_DOT[c]} ${
                          newColor === c
                            ? `ring-2 ring-offset-1 ring-offset-[#050510] scale-110 ${COLOR_RING[c]}`
                            : "opacity-40 hover:opacity-70"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={!newTitle.trim()}
                    className="ml-auto rounded-2xl border border-[#3b82f6]/24 bg-[#3b82f6]/14 px-4 py-2 text-sm text-[#93c5fd] transition-all duration-200 hover:border-[#3b82f6]/38 hover:bg-[#3b82f6]/22 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.97]"
                  >
                    Toevoegen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="px-4 py-3">
            {sortedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 text-3xl opacity-30">📋</div>
                <p className="text-sm text-white/28">Nog niets gepland.</p>
                <p className="mt-1 text-xs text-white/18">Klik op + om iets toe te voegen.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sortedItems.map(item => (
                  <div
                    key={item.id}
                    className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-200 ${
                      item.done
                        ? "border-white/4 bg-white/[0.015] opacity-40"
                        : `${COLOR_BG[item.color]}`
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => toggleDone(item.id)}
                      className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ${
                        item.done
                          ? `${COLOR_DOT[item.color]} border-transparent`
                          : "border-white/20 hover:border-white/40"
                      }`}
                    >
                      {item.done && (
                        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                          <path d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </button>

                    {/* Time */}
                    {item.time && (
                      <span className={`shrink-0 font-mono text-xs tabular-nums ${item.done ? "text-white/30" : COLOR_TEXT[item.color]}`}>
                        {item.time}
                      </span>
                    )}

                    {/* Title */}
                    <span className={`flex-1 text-sm leading-5 ${item.done ? "line-through text-white/30" : "text-white/88"}`}>
                      {item.title}
                    </span>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-full text-white/30 hover:text-white/70 transition-all duration-150"
                    >
                      <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M2 2l10 10M12 2L2 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/6">
            <a
              href="/personal-workspace"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#3b82f6]/18 bg-[#3b82f6]/8 py-3 text-sm text-[#93c5fd] transition-all duration-200 hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/14 hover:text-white hover:shadow-[0_8px_20px_rgba(59,130,246,0.14)] active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Ga naar chat
            </a>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        main > * {
          animation: fadeInUp 0.28s ease-out both;
        }
        main > *:nth-child(2) {
          animation-delay: 0.06s;
        }
      `}</style>
    </div>
  );
}