"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgendaItem {
  id: string;
  date: string;   // "YYYY-MM-DD"
  time: string;   // "HH:MM" or ""
  title: string;
  done: boolean;
  color: "blue" | "purple" | "green" | "amber";
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const AGENDA_KEY = "openlura_dashboard_agenda";

function loadItems(): AgendaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AGENDA_KEY);
    const parsed: any[] = raw ? JSON.parse(raw) : [];
    const today = toDateStr(new Date());
    return parsed.map((i: any) => ({
      ...i,
      date: i.date ?? today,
      color: i.color ?? "blue",
    }));
  } catch { return []; }
}

function saveItems(items: AgendaItem[]) {
  try { localStorage.setItem(AGENDA_KEY, JSON.stringify(items)); } catch {}
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatClock(d: Date) {
  return d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDateLong(d: Date) {
  return d.toLocaleDateString("nl-NL", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatMonthYear(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Mon=0 .. Sun=6
}

const NL_WEEKDAYS_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const NL_WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

// ─── Colors ───────────────────────────────────────────────────────────────────

const COLOR_DOT: Record<AgendaItem["color"], string> = {
  blue: "bg-[#3b82f6]", purple: "bg-purple-400", green: "bg-emerald-400", amber: "bg-amber-400",
};
const COLOR_RING: Record<AgendaItem["color"], string> = {
  blue: "ring-[#3b82f6]/50", purple: "ring-purple-400/50", green: "ring-emerald-400/50", amber: "ring-amber-400/50",
};
const COLOR_TEXT: Record<AgendaItem["color"], string> = {
  blue: "text-[#93c5fd]", purple: "text-purple-300", green: "text-emerald-300", amber: "text-amber-300",
};
const COLOR_LEFT: Record<AgendaItem["color"], string> = {
  blue: "border-l-[#3b82f6]", purple: "border-l-purple-400", green: "border-l-emerald-400", amber: "border-l-amber-400",
};
const COLOR_BLOCKBG: Record<AgendaItem["color"], string> = {
  blue: "bg-[#3b82f6]/8", purple: "bg-purple-400/8", green: "bg-emerald-400/8", amber: "bg-amber-400/8",
};
const COLOR_TASKBORDER: Record<AgendaItem["color"], string> = {
  blue: "border-[#3b82f6]/20 bg-[#3b82f6]/10",
  purple: "border-purple-400/20 bg-purple-400/10",
  green: "border-emerald-400/20 bg-emerald-400/10",
  amber: "border-amber-400/20 bg-amber-400/10",
};
const COLORS: AgendaItem["color"][] = ["blue", "purple", "green", "amber"];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PersonalDashboardPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [items, setItems] = useState<AgendaItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Add form
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newColor, setNewColor] = useState<AgendaItem["color"]>("blue");
  const [newDate, setNewDate] = useState(toDateStr(new Date()));
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function check() {
      try {
        await fetch("/api/auth?action=refresh", { method: "GET", credentials: "same-origin", cache: "no-store" }).catch(() => null);
        const res = await fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (data?.authenticated) {
          setAuthed(true);
          const sr = await fetch("/api/personal-state", { method: "GET", credentials: "same-origin", headers: { "x-openlura-personal-env": "true" }, cache: "no-store" }).catch(() => null);
          if (sr?.ok) {
            const sd = await sr.json().catch(() => null);
            const name = sd?.profile?.name || sd?.state?.profile?.name;
            if (name) setUserName(name);
          }
        } else {
          router.replace("/login");
        }
      } catch { router.replace("/login"); }
      finally { setAuthChecked(true); }
    }
    check();
  }, [router]);

  // ── Clock ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ── Items ─────────────────────────────────────────────────────────────────
  useEffect(() => { setItems(loadItems()); }, []);
  useEffect(() => { saveItems(items); }, [items]);
  useEffect(() => { if (addOpen) setTimeout(() => inputRef.current?.focus(), 60); }, [addOpen]);

  // sync newDate when selectedDate changes
  useEffect(() => { setNewDate(selectedDate); }, [selectedDate]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addItem = () => {
    const title = newTitle.trim();
    if (!title) return;
    setItems(prev => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      date: newDate || selectedDate,
      time: newTime,
      title,
      done: false,
      color: newColor,
    }]);
    setNewTitle(""); setNewTime(""); setNewColor("blue"); setAddOpen(false);
  };

  const toggleDone = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));

  const removeItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id));

  // ── Derived ───────────────────────────────────────────────────────────────
  const todayStr = toDateStr(new Date());
  const selectedItems = items.filter(i => i.date === selectedDate);
  const selectedAgenda = selectedItems.filter(i => i.time).sort((a, b) => a.time.localeCompare(b.time));
  const selectedTasks = selectedItems.filter(i => !i.time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hours = now.getHours();
  const greeting = hours < 6 ? "Goedenacht" : hours < 12 ? "Goedemorgen" : hours < 18 ? "Goedemiddag" : "Goedenavond";

  // Days in month with item counts
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const itemsByDate: Record<string, number> = {};
  items.forEach(i => { itemsByDate[i.date] = (itemsByDate[i.date] || 0) + 1; });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!authChecked) return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
      <div className="h-6 w-6 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
    </div>
  );
  if (!authed) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050510] text-white">

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[#1d4ed8]/6 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[500px] rounded-full bg-purple-600/4 blur-[120px]" />
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
        <a href="/personal-workspace" className="flex items-center gap-2 rounded-full border border-[#3b82f6]/22 bg-[#3b82f6]/10 px-4 py-2 text-sm text-[#93c5fd] transition-all duration-200 hover:border-[#3b82f6]/40 hover:bg-[#3b82f6]/18 hover:text-white active:scale-[0.97]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </a>
      </header>

      {/* Body */}
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">

        {/* Top row: greeting + clock */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-white/28">{greeting}</p>
            <h1 className="mt-0.5 text-3xl font-semibold tracking-tight text-white/92">
              {userName ? `${userName} 👋` : "Dashboard 👋"}
            </h1>
            <p className="mt-1 capitalize text-sm text-white/40">{formatDateLong(now)}</p>
          </div>
          <div className="font-mono text-2xl tabular-nums text-[#3b82f6]/60 tracking-tight">
            {formatClock(now)}
          </div>
        </div>

        {/* Main grid: calendar left, day detail right */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* LEFT: Day detail */}
          <div className="flex flex-col gap-6">

            {/* Selected day header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white/88">
                  {selectedDate === todayStr ? "Vandaag" :
                    new Date(selectedDate + "T00:00:00").toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
                </h2>
                <p className="text-xs text-white/32 mt-0.5">
                  {selectedItems.length === 0 ? "Niets gepland" : `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddOpen(v => !v)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all duration-200 active:scale-95 ${
                  addOpen
                    ? "border-[#3b82f6]/30 bg-[#3b82f6]/14 text-[#93c5fd]"
                    : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/16 hover:text-white"
                }`}
              >
                <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-200 ${addOpen ? "rotate-45" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Toevoegen
              </button>
            </div>

            {/* Add form */}
            {addOpen && (
              <div className="rounded-[20px] border border-white/8 bg-white/[0.03] px-5 py-4">
                <div className="flex flex-col gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setAddOpen(false); }}
                    placeholder="Wat wil je inplannen?"
                    className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white/90 outline-none placeholder:text-white/24 focus:border-[#3b82f6]/28 transition-colors"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/70 outline-none [color-scheme:dark]"
                    />
                    <input
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-sm text-white/70 outline-none [color-scheme:dark]"
                    />
                    <div className="flex items-center gap-1.5">
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setNewColor(c)}
                          className={`h-5 w-5 rounded-full transition-all duration-150 ${COLOR_DOT[c]} ${newColor === c ? `ring-2 ring-offset-1 ring-offset-[#050510] scale-110 ${COLOR_RING[c]}` : "opacity-40 hover:opacity-70"}`}
                        />
                      ))}
                    </div>
                    <button type="button" onClick={addItem} disabled={!newTitle.trim()}
                      className="ml-auto rounded-xl border border-[#3b82f6]/24 bg-[#3b82f6]/14 px-4 py-2 text-sm text-[#93c5fd] transition-all hover:bg-[#3b82f6]/22 hover:text-white disabled:opacity-30 active:scale-[0.97]">
                      Opslaan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Agenda tijdlijn */}
            {selectedAgenda.length > 0 && (
              <div className="rounded-[20px] border border-white/8 bg-white/[0.025] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/6">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/32">Agenda</p>
                </div>
                <div className="px-5 py-3 space-y-1">
                  {selectedAgenda.map((item, idx) => {
                    const mins = timeToMinutes(item.time);
                    const isPast = selectedDate === todayStr && mins < nowMinutes;
                    const isNow = selectedDate === todayStr && Math.abs(mins - nowMinutes) < 30;
                    return (
                      <div key={item.id} className="group flex items-stretch gap-4 min-h-[48px]">
                        <div className="flex flex-col items-end w-10 shrink-0 pt-1.5">
                          <span className={`font-mono text-xs tabular-nums ${isPast ? "text-white/18" : isNow ? COLOR_TEXT[item.color] : "text-white/38"}`}>
                            {item.time}
                          </span>
                        </div>
                        <div className="flex flex-col items-center w-3 shrink-0">
                          <div className={`mt-2 h-2 w-2 rounded-full shrink-0 ${COLOR_DOT[item.color]} ${isPast ? "opacity-25" : ""} ${isNow ? `ring-2 ring-offset-1 ring-offset-[#050510] ${COLOR_RING[item.color]}` : ""}`} />
                          {idx < selectedAgenda.length - 1 && <div className="flex-1 w-px bg-white/6 mt-1" />}
                        </div>
                        <div className={`flex-1 pb-2 ${isPast ? "opacity-35" : ""}`}>
                          <div className={`flex items-center justify-between rounded-xl border-l-2 px-3 py-2 ${COLOR_LEFT[item.color]} ${COLOR_BLOCKBG[item.color]}`}>
                            <div>
                              <p className={`text-sm ${item.done ? "line-through text-white/30" : "text-white/88"}`}>{item.title}</p>
                              {isNow && !item.done && (
                                <span className={`text-[10px] font-medium uppercase tracking-wide ${COLOR_TEXT[item.color]}`}>Nu bezig</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => toggleDone(item.id)}
                                className="h-6 w-6 flex items-center justify-center rounded-full text-white/30 hover:text-emerald-400 transition-colors">
                                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5" /></svg>
                              </button>
                              <button type="button" onClick={() => removeItem(item.id)}
                                className="h-6 w-6 flex items-center justify-center rounded-full text-white/30 hover:text-red-400 transition-colors">
                                <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Taken */}
            {selectedTasks.length > 0 && (
              <div className="rounded-[20px] border border-white/8 bg-white/[0.025] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/6">
                  <p className="text-xs uppercase tracking-[0.14em] text-white/32">Taken</p>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {selectedTasks.map(item => (
                    <div key={item.id} className={`group flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${item.done ? "border-white/4 bg-white/[0.01] opacity-40" : COLOR_TASKBORDER[item.color]}`}>
                      <button type="button" onClick={() => toggleDone(item.id)}
                        className={`shrink-0 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${item.done ? `${COLOR_DOT[item.color]} border-transparent` : "border-white/20 hover:border-white/40"}`}>
                        {item.done && <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5" /></svg>}
                      </button>
                      <span className={`flex-1 text-sm ${item.done ? "line-through text-white/30" : "text-white/88"}`}>{item.title}</span>
                      <button type="button" onClick={() => removeItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-full text-white/30 hover:text-red-400 transition-all">
                        <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lege dag */}
            {selectedItems.length === 0 && !addOpen && (
              <div className="rounded-[20px] border border-dashed border-white/8 px-6 py-12 text-center">
                <p className="text-2xl mb-3 opacity-20">📅</p>
                <p className="text-sm text-white/28">Niets gepland voor deze dag.</p>
                <p className="text-xs text-white/18 mt-1">Klik op Toevoegen om iets in te plannen.</p>
              </div>
            )}
          </div>

          {/* RIGHT: Kalender */}
          <div className="flex flex-col gap-4">
            <div className="rounded-[20px] border border-white/8 bg-white/[0.025] overflow-hidden">

              {/* Maand navigatie */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <button type="button" onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }} className="h-7 w-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/8 transition-all">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                </button>
                <button type="button" onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); }}
                  className="text-sm font-medium text-white/80 capitalize hover:text-white transition-colors">
                  {formatMonthYear(calYear, calMonth)}
                </button>
                <button type="button" onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }} className="h-7 w-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/8 transition-all">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>

              {/* Weekdag headers */}
              <div className="grid grid-cols-7 px-3 pt-3">
                {NL_WEEKDAYS_SHORT.map(d => (
                  <div key={d} className="text-center text-[10px] uppercase tracking-wide text-white/24 pb-2">{d}</div>
                ))}
              </div>

              {/* Dagen */}
              <div className="grid grid-cols-7 gap-0.5 px-3 pb-3">
                {/* Lege cellen voor eerste dag */}
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = dateStr === todayStr;
                  const isSelected = dateStr === selectedDate;
                  const count = itemsByDate[dateStr] || 0;

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 text-sm transition-all duration-150 active:scale-95 ${
                        isSelected
                          ? "bg-[#3b82f6] text-white font-semibold shadow-[0_4px_12px_rgba(59,130,246,0.30)]"
                          : isToday
                          ? "border border-[#3b82f6]/30 text-[#93c5fd]"
                          : "text-white/50 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {day}
                      {count > 0 && !isSelected && (
                        <span className={`mt-0.5 h-1 w-1 rounded-full ${isToday ? "bg-[#3b82f6]" : "bg-white/30"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Aankomende items */}
            {(() => {
              const upcoming = items
                .filter(i => i.date > todayStr && !i.done)
                .sort((a, b) => a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date))
                .slice(0, 5);

              if (upcoming.length === 0) return null;

              return (
                <div className="rounded-[20px] border border-white/8 bg-white/[0.025] overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/6">
                    <p className="text-xs uppercase tracking-[0.14em] text-white/32">Aankomend</p>
                  </div>
                  <div className="px-4 py-2 space-y-1">
                    {upcoming.map(item => {
                      const d = new Date(item.date + "T00:00:00");
                      const dayLabel = d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
                      return (
                        <button key={item.id} type="button" onClick={() => { setSelectedDate(item.date); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
                          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.04] transition-colors group">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${COLOR_DOT[item.color]}`} />
                          <span className="flex-1 text-sm text-white/70 group-hover:text-white/90 truncate transition-colors">{item.title}</span>
                          <span className="shrink-0 text-xs text-white/28 capitalize">{dayLabel}{item.time ? ` · ${item.time}` : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .relative.z-10.mx-auto > * {
          animation: fadeIn 0.24s ease-out both;
        }
      `}</style>
    </div>
  );
}
