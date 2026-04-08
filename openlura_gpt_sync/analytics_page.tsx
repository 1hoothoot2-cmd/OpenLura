"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// ─── TYPES ───────────────────────────────────────────────────────────────────

type AnalyticsFeedbackItem = {
  chatId?: string | null;
  msgIndex?: number | null;
  type?: string | null;
  message?: string | null;
  userMessage?: string | null;
  source?: string | null;
  environment?: string | null;
  userScope?: string | null;
  user_id?: string | null;
  workflowKey?: string | null;
  workflowStatus?: string | null;
  timestamp?: string | null;
  learningType?: string | null;
  _localOnly?: boolean;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function inferLearningType(f: any): "style" | "content" {
  if (f.learningType === "style" || f.learningType === "content") return f.learningType;
  const text = `${f.userMessage || ""} ${f.message || ""}`.toLowerCase();
  return /korter|te lang|too long|shorter|duidelijker|onduidelijk|clearer|unclear|andere structuur|structuur|structure|te vaag|vaag|vague|meer context|more context|more depth|te serieus|te formeel|menselijker|spontaner|luchtiger|more natural|too formal|too long for chat/.test(text)
    ? "style" : "content";
}

function getAutoDebugConfidence(f: any): string {
  return String(f.message || "").toLowerCase().match(/^\[(high|medium|low)\]/)?.[1] || "unknown";
}

function getAutoDebugSignalType(f: any): string {
  const s = String(f.source || "");
  if (s.includes("auto_debug_casual_mismatch")) return "casual_mismatch";
  if (s.includes("auto_debug_possible_search_miss")) return "possible_search_miss";
  if (s.includes("auto_debug_possible_image_context_miss")) return "possible_image_context_miss";
  if (s.includes("auto_debug_reformulation")) return "reformulation";
  if (s.includes("auto_debug_followup_depth")) return "followup_depth";
  if (s.includes("auto_debug_too_verbose_for_image_route")) return "verbose_image";
  return "unknown";
}

function translateLearningRule(rule: string, lang: string): string {
  const map: Record<string, Record<string, string>> = {
    "Shorter answers active": { nl: "Kortere antwoorden actief", en: "Shorter answers active", de: "Kürzere Antworten aktiv", fr: "Réponses plus courtes actives", es: "Respuestas más cortas activas" },
    "Clearer explanations active": { nl: "Duidelijkere uitleg actief", en: "Clearer explanations active", de: "Klarere Erklärungen aktiv", fr: "Explications plus claires actives", es: "Explicaciones más claras activas" },
    "Better structure active": { nl: "Betere structuur actief", en: "Better structure active", de: "Bessere Struktur aktiv", fr: "Meilleure structure active", es: "Mejor estructura activa" },
    "More concrete answers active": { nl: "Concretere antwoorden actief", en: "More concrete answers active", de: "Konkretere Antworten aktiv", fr: "Réponses plus concrètes actives", es: "Respuestas más concretas activas" },
    "More context active": { nl: "Meer context actief", en: "More context active", de: "Mehr Kontext aktiv", fr: "Plus de contexte actif", es: "Más contexto activo" },
    "Bug focus active": { nl: "Bug focus actief", en: "Bug focus active", de: "Bug-Fokus aktiv", fr: "Focalisation sur les bugs active", es: "Foco en bugs activo" },
  };
  return map[rule]?.["en"] ?? rule;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`rounded-2xl p-5 flex flex-col gap-1 ${color || "bg-white/5 border border-white/10"}`}>
      <p className="text-xs font-medium tracking-widest uppercase opacity-50">{label}</p>
      <p className="text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs opacity-40 mt-1">{sub}</p>}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-semibold tracking-widest uppercase opacity-70">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-sm opacity-70">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${accent || ""}`}>{value}</span>
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 border border-white/8 rounded-2xl p-5 ${className || ""}`}>
      {children}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-medium ${color}`}>{label}</span>;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {

  const getOrCreateOpenLuraUserId = () => {
    if (typeof window === "undefined") return "";
    const storageKey = "openlura_user_id";
    const existing = localStorage.getItem(storageKey);
    if (existing?.trim()) return existing.trim();
    const newId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `openlura_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(storageKey, newId);
    return newId;
  };

  const getHeaders = (json = true) => {
    const h: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
    const uid = getOrCreateOpenLuraUserId();
    if (uid) h["x-openlura-user-id"] = uid;
    return h;
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [feedback, setFeedback] = useState<AnalyticsFeedbackItem[]>([]);
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [itemStatus, setItemStatus] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<"overview" | "learning" | "signals" | "workflow" | "feed">("overview");
  const [localStats, setLocalStats] = useState({ total: 0 });
  const latestRef = useRef<AnalyticsFeedbackItem[]>([]);
  const hasServerRef = useRef(false);
  const pendingInsightsRef = useRef<Set<string>>(new Set());
  const STORAGE_KEY = "openlura_analytics_unlocked";

  // ── Auth check ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
    (async () => {
      try {
        const res = await fetch("/api/feedback", { method: "GET", headers: getHeaders(false), cache: "no-store" });
        if (res.ok) { setIsUnlocked(true); setAuthError(""); }
        else if (res.status === 401) setIsUnlocked(false);
      } catch { setAuthError(""); }
      finally { setAuthLoading(false); }
    })();
  }, []);

  // ── Data helpers ───────────────────────────────────────────────────────────
  function getItemKey(f: AnalyticsFeedbackItem) {
    if (f.workflowKey?.trim()) return f.workflowKey.trim();
    return [f.chatId || "", f.msgIndex ?? "", f.type || "", f.source || "", f.environment || "", f.userScope || "", f.user_id || "", f.userMessage || "", f.message || ""].join("::");
  }

  function getAutoStatus(f: any) { return f.type === "up" ? "klaar" : "nieuw"; }

  function getResolvedStatus(f: AnalyticsFeedbackItem) {
    if (f.workflowKey && itemStatus[f.workflowKey]) return itemStatus[f.workflowKey];
    const k = getItemKey(f);
    if (itemStatus[k]) return itemStatus[k];
    return getAutoStatus(f);
  }

  function getUserScope(f: any) {
    if (["admin","guest","personal","user"].includes(f.userScope)) return f.userScope;
    if (f.environment === "personal" && f.user_id) return "personal";
    if (f.environment === "default" && f.user_id) return "user";
    return "guest";
  }

  function isRenderable(f: AnalyticsFeedbackItem) {
    const validType = ["up","down","improve","idea","auto_debug"].includes(f.type || "");
    const validEnv = ["default","personal"].includes(f.environment || "");
    const validScope = ["admin","guest","personal","user"].includes(f.userScope || "");
    if (!validType || !validEnv || !validScope) return false;
    if (f.environment === "personal" && !f.user_id) return false;
    if (f.userScope === "personal" && !f.user_id) return false;
    if (f.userScope === "user" && !f.user_id) return false;
    return true;
  }

  // ── Data load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isUnlocked) return;

    const load = async () => {
      const defLocal = safeParseJson<any[]>(localStorage.getItem("openlura_feedback"), []);
      const perLocal = safeParseJson<any[]>(localStorage.getItem("openlura_personal_feedback"), []);
      setLocalStats({ total: defLocal.length + perLocal.length });

      let data: AnalyticsFeedbackItem[] = [];
      let ok = false;

      try {
        const res = await fetch("/api/feedback", { method: "GET", headers: getHeaders(false), cache: "no-store" });
        if (res.status === 401) { setIsUnlocked(false); setFeedback([]); latestRef.current = []; hasServerRef.current = false; setItemStatus({}); return; }
        if (!res.ok) throw new Error("fetch failed");
        const raw: unknown = await res.json();
        data = Array.isArray(raw) ? raw : [];
        ok = true;
      } catch { /* server unavailable */ }

      const workflowEntries = data.filter(i => i.type === "workflow_status" && i.source === "analytics_workflow" && i.workflowKey && i.workflowStatus);
      const statusMap = workflowEntries
        .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime())
        .reduce((acc: Record<string, string>, i) => { if (i.workflowKey && i.workflowStatus) acc[i.workflowKey] = i.workflowStatus; return acc; }, {});

      if (ok) { hasServerRef.current = true; setItemStatus(statusMap); }

      const normalFeedback = data
        .filter(i => i.type !== "workflow_status")
        .map(i => {
          const env = i.environment === "personal" ? "personal" : "default";
          const scope = ["admin","guest","personal","user"].includes(i.userScope || "") ? i.userScope
            : env === "personal" && i.user_id ? "personal" : i.user_id ? "user" : "guest";
          return {
            ...i, _localOnly: false, environment: env, userScope: scope, user_id: i.user_id || null,
            learningType: i.learningType || (["down","improve","auto_debug"].includes(i.type || "") ? inferLearningType(i) : null),
            workflowKey: i.workflowKey || [i.chatId || "", i.msgIndex ?? "", i.type || "", i.source || "", env, scope, i.user_id || "", i.userMessage || "", i.message || ""].join("::"),
          };
        })
        .filter(i => isRenderable(i));

      const source = ok ? normalFeedback : hasServerRef.current ? latestRef.current : [];
      const deduped = source.filter((i, idx, arr) => idx === arr.findIndex(x => getItemKey(x) === getItemKey(i)));
      const sorted = [...deduped].sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      latestRef.current = sorted;
      setFeedback(sorted);
    };

    const run = () => load().catch(console.error);
    run();
    const poll = window.setInterval(run, 5000);
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    window.addEventListener("openlura_feedback_update", run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(poll); window.removeEventListener("openlura_feedback_update", run); window.removeEventListener("focus", run); document.removeEventListener("visibilitychange", onVis); };
  }, [isUnlocked]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const neg = feedback.filter(f => f.type === "down");
  const pos = feedback.filter(f => f.type === "up");
  const improve = feedback.filter(f => f.type === "improve");
  const autoDebug = feedback.filter(f => f.type === "auto_debug");
  const ideas = feedback.filter(f => f.type === "idea");
  const bugs = ideas.filter(f => f.source === "idea_bug");
  const adjustments = ideas.filter(f => f.source === "idea_adjustment");
  const learningIdeas = ideas.filter(f => f.source === "idea_feedback_learning");

  const score = feedback.length > 0 ? Math.round((pos.length / Math.max(pos.length + neg.length, 1)) * 100) : 0;

  // Implicit signals
  const reformulations = feedback.filter(f => f.type === "auto_debug" && String(f.source || "").includes("auto_debug_reformulation"));
  const followups = feedback.filter(f => f.type === "auto_debug" && String(f.source || "").includes("auto_debug_followup_depth"));
  const longSessions = feedback.filter(f => f.type === "up" && String(f.source || "") === "implicit_long_session");
  const qualityScore = longSessions.length + reformulations.length === 0 ? null
    : Math.round((longSessions.length / Math.max(longSessions.length + reformulations.length, 1)) * 100);

  // Learning pool
  const learningPool = [...learningIdeas, ...improve, ...neg];

  const improvementTexts = improve.map(f => (f.message || "").toLowerCase().trim()).filter(Boolean);
  const complaintKeywords = ["korter","te lang","shorter","too long","duidelijker","onduidelijk","clearer","unclear","te vaag","vague","meer context","more context","structure","structuur","wrong","incorrect"];

  const topComplaints = useMemo(() =>
    complaintKeywords
      .map(kw => ({ keyword: kw, count: improvementTexts.filter(t => t.includes(kw)).length }))
      .filter(i => i.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    [improvementTexts]
  );

  const activeLearningRules: string[] = [
    topComplaints.some(c => c.keyword.includes("korter") || c.keyword.includes("shorter") || c.keyword.includes("te lang") || c.keyword.includes("too long")) && "Shorter answers active",
    topComplaints.some(c => c.keyword.includes("duidelijker") || c.keyword.includes("clearer") || c.keyword.includes("onduidelijk") || c.keyword.includes("unclear")) && "Clearer explanations active",
    topComplaints.some(c => c.keyword.includes("structuur") || c.keyword.includes("structure")) && "Better structure active",
    topComplaints.some(c => c.keyword.includes("te vaag") || c.keyword.includes("vague")) && "More concrete answers active",
    topComplaints.some(c => c.keyword.includes("meer context") || c.keyword.includes("more context")) && "More context active",
    bugs.length > 0 && "Bug focus active",
  ].filter(Boolean) as string[];

  // Language detection from userMessages
  const languageCounts = feedback.reduce((acc: Record<string, number>, f) => {
    const msg = (f.userMessage || "").toLowerCase();
    if (!msg) return acc;
    const lang = /\b(de|het|een|en|van|is|dat|wat|hoe|waar|ik|je|niet|ook)\b/.test(msg) ? "Dutch"
      : /\b(le|la|les|un|une|et|est|que|qui|dans|pour)\b/.test(msg) ? "French"
      : /\b(der|die|das|ein|und|ist|ich|du|wir|nicht)\b/.test(msg) ? "German"
      : /\b(el|la|los|un|una|y|es|no|que|de)\b/.test(msg) ? "Spanish"
      : "English";
    acc[lang] = (acc[lang] || 0) + 1;
    return acc;
  }, {});

  // Auto debug breakdown
  const debugSignals = {
    casualMismatch: autoDebug.filter(f => String(f.source || "").includes("auto_debug_casual_mismatch")).length,
    searchMiss: autoDebug.filter(f => String(f.source || "").includes("auto_debug_possible_search_miss")).length,
    imageMiss: autoDebug.filter(f => String(f.source || "").includes("auto_debug_possible_image_context_miss")).length,
    verbose: autoDebug.filter(f => String(f.source || "").includes("auto_debug_too_verbose_for_image_route")).length,
    highConf: autoDebug.filter(f => getAutoDebugConfidence(f) === "high").length,
    medConf: autoDebug.filter(f => getAutoDebugConfidence(f) === "medium").length,
    lowConf: autoDebug.filter(f => getAutoDebugConfidence(f) === "low").length,
  };

  // Workflow counts
  const bugNewCount = bugs.filter(f => getResolvedStatus(f) === "nieuw").length;
  const bugBezigCount = bugs.filter(f => getResolvedStatus(f) === "bezig").length;
  const bugDoneCount = bugs.filter(f => getResolvedStatus(f) === "klaar").length;

  // ── Insight push ───────────────────────────────────────────────────────────
  const pushInsight = async (key: string, message: string) => {
    const sk = "openlura_auto_learning_insights";
    const existing = safeParseJson<string[]>(localStorage.getItem(sk), []);
    const alreadyIn = feedback.some(i => i.type === "idea" && i.source === "idea_feedback_learning" && i.userMessage === "Auto learning insight" && (i.message || "").trim() === message.trim());
    if (existing.includes(key) || alreadyIn || pendingInsightsRef.current.has(key)) return;
    pendingInsightsRef.current.add(key);
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: getHeaders(), body: JSON.stringify({ type: "idea", message, userMessage: "Auto learning insight", source: "idea_feedback_learning", learningType: "content", environment: "default" }) });
      if (!res.ok) { pendingInsightsRef.current.delete(key); return; }
      try { localStorage.setItem(sk, JSON.stringify([...existing, key])); } catch {}
      pendingInsightsRef.current.delete(key);
      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch { pendingInsightsRef.current.delete(key); }
  };

  useEffect(() => {
    if (!isUnlocked || feedback.length === 0) return;
    if (topComplaints.some(c => c.keyword.includes("korter") || c.keyword.includes("shorter") || c.keyword.includes("te lang") || c.keyword.includes("too long"))) pushInsight("shorter_answers", "AI replies are often too long. Always prefer shorter, more direct answers. Cut filler aggressively.");
    if (topComplaints.some(c => c.keyword.includes("duidelijker") || c.keyword.includes("clearer") || c.keyword.includes("onduidelijk") || c.keyword.includes("unclear"))) pushInsight("clearer_explanations", "Users want clearer explanations and simpler wording. Avoid complex or vague phrasing.");
    if (topComplaints.some(c => c.keyword.includes("structuur") || c.keyword.includes("structure"))) pushInsight("better_structure", "Users want cleaner structure and better flow in answers. Use clear sections and logical ordering.");
    if (bugs.length > 0) pushInsight("bug_priority", "Bug reports are the highest priority. Acknowledge issues clearly and be precise in responses.");
  }, [isUnlocked, feedback.length, topComplaints.map(i => `${i.keyword}:${i.count}`).join("|")]);

  // ── Status update ──────────────────────────────────────────────────────────
  const updateStatus = async (key: string, status: string) => {
    const prev = itemStatus[key];
    setItemStatus(s => ({ ...s, [key]: status }));
    try {
      const item = feedback.find(f => getItemKey(f) === key);
      if (!item) return;
      const res = await fetch("/api/feedback", { method: "POST", headers: getHeaders(), body: JSON.stringify({ action: "update_workflow_status", chatId: item.chatId ?? null, msgIndex: item.msgIndex ?? null, type: "workflow_status", message: status, userMessage: item.userMessage ?? null, source: "analytics_workflow", environment: "default", workflowKey: key, workflowStatus: status }) });
      if (!res.ok) throw new Error("sync failed");
      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch {
      setItemStatus(s => { const n = { ...s }; if (prev !== undefined) n[key] = prev; else delete n[key]; return n; });
    }
  };

  // ── Unlock ─────────────────────────────────────────────────────────────────
  const handleUnlock = async () => {
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: getHeaders(), body: JSON.stringify({ action: "unlock_analytics", password }) });
      if (!res.ok) { setIsUnlocked(false); setAuthError("Incorrect password"); return; }
      setIsUnlocked(true); setAuthError(""); setPassword("");
      window.dispatchEvent(new Event("openlura_feedback_update"));
    } catch { setIsUnlocked(false); setAuthError("Login failed"); }
  };

  const handleLogout = async () => {
    try { await fetch("/api/feedback", { method: "DELETE", headers: getHeaders(false) }); } catch {}
    try { localStorage.removeItem("openlura_auto_learning_insights"); } catch {}
    if (typeof window !== "undefined") sessionStorage.removeItem(STORAGE_KEY);
    setItemStatus({}); setIsUnlocked(false); setFeedback([]); latestRef.current = []; hasServerRef.current = false;
  };

  const downloadCSV = (weekOnly = false) => {
    const now = Date.now();
    const rows = feedback.filter(f => {
      if (!["up","down","improve","idea"].includes(f.type || "")) return false;
      if (weekOnly && f.timestamp && now - new Date(f.timestamp).getTime() > 7 * 24 * 60 * 60 * 1000) return false;
      return true;
    });
    const hdrs = ["type","userMessage","message","source","environment","userScope","learningType","timestamp"];
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [hdrs.join(","), ...rows.map(f => hdrs.map(h => esc((f as any)[h])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `openlura-feedback-${weekOnly ? "week" : "all"}-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Auth screens ───────────────────────────────────────────────────────────
  if (authLoading) return (
    <main className="min-h-screen bg-[#070710] text-white flex items-center justify-center">
      <div className="text-center opacity-40 text-sm tracking-widest uppercase">Loading analytics...</div>
    </main>
  );

  if (!isUnlocked) return (
    <main className="min-h-screen bg-[#070710] text-white flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs tracking-widest uppercase opacity-40 mb-2">OpenLura</p>
          <h1 className="text-2xl font-bold">Analytics</h1>
        </div>
        <form onSubmit={e => { e.preventDefault(); handleUnlock(); }} className="space-y-3">
          <input type="password" name="analytics_password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); if (authError) setAuthError(""); }} className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10 outline-none focus:border-white/30 text-sm placeholder:opacity-30" placeholder="Password" />
          {authError && <p className="text-red-400 text-sm">{authError}</p>}
          <button type="submit" className="w-full py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-white/90 transition-colors">Unlock</button>
        </form>
      </div>
    </main>
  );

  // ── MAIN DASHBOARD ─────────────────────────────────────────────────────────

  const NAV = [
    { id: "overview", label: "Overview" },
    { id: "learning", label: "AI Learning" },
    { id: "signals", label: "Signals" },
    { id: "workflow", label: "Workflow" },
    { id: "feed", label: "Feed" },
  ] as const;

  return (
    <main className="min-h-screen bg-[#070710] text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
        body { font-family: 'DM Sans', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }
        .bg-white\\/8 { background: rgba(255,255,255,0.08); }
        .border-white\\/8 { border-color: rgba(255,255,255,0.08); }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#070710]/95 backdrop-blur-sm border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs">📊</div>
            <span className="text-sm font-semibold">OpenLura Analytics</span>
            <span className="text-xs opacity-30 mono">{feedback.filter(f => !f._localOnly).length} items</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadCSV(true)} className="text-xs px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 transition-colors border border-white/8">↓ Week</button>
            <button onClick={() => downloadCSV(false)} className="text-xs px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 transition-colors border border-white/8">↓ All</button>
            <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 transition-colors border border-white/8 opacity-60">Logout</button>
          </div>
        </div>

        {/* Nav */}
        <div className="max-w-6xl mx-auto px-6 flex gap-1 pb-2">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setActiveSection(n.id)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSection === n.id ? "bg-white/12 text-white" : "text-white/40 hover:text-white/70"}`}>
              {n.label}
            </button>
          ))}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
        {activeSection === "overview" && (
          <div>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <KPICard label="Feedback score" value={`${score}%`} sub={`${pos.length} positive · ${neg.length} negative`} color={score >= 70 ? "bg-emerald-500/10 border border-emerald-500/20" : score >= 50 ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-red-500/10 border border-red-500/20"} />
              <KPICard label="Total feedback" value={feedback.length} sub={`${localStats.total} local · ${feedback.filter(f => !f._localOnly).length} server`} />
              <KPICard label="Session quality" value={qualityScore !== null ? `${qualityScore}%` : "—"} sub={`${longSessions.length} long · ${reformulations.length} reformulations`} color="bg-teal-500/10 border border-teal-500/20" />
              <KPICard label="Auto Debug" value={autoDebug.length} sub={`${debugSignals.highConf} high · ${debugSignals.medConf} medium`} color="bg-purple-500/10 border border-purple-500/20" />
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
              {[
                { label: "Improve", value: improve.length, color: "text-yellow-400" },
                { label: "Ideas", value: ideas.length, color: "text-blue-400" },
                { label: "Bugs", value: bugs.length, color: "text-red-400" },
                { label: "Adjustments", value: adjustments.length, color: "text-orange-400" },
                { label: "AI feedback", value: learningIdeas.length, color: "text-green-400" },
                { label: "Auto insights", value: reformulations.length + followups.length, color: "text-teal-400" },
              ].map(k => (
                <div key={k.label} className="bg-white/5 border border-white/8 rounded-xl p-4 text-center">
                  <p className={`text-2xl font-bold mono ${k.color}`}>{k.value}</p>
                  <p className="text-xs opacity-40 mt-1">{k.label}</p>
                </div>
              ))}
            </div>

            {/* Active Learning Rules */}
            <Section title="What the AI is learning right now" icon="🧠">
              {activeLearningRules.length === 0 ? (
                <Card><p className="text-sm opacity-40">No active learning rules yet. More feedback needed.</p></Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {activeLearningRules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-3 bg-emerald-500/8 border border-emerald-500/15 rounded-xl p-4">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      <div>
                        <p className="text-sm font-medium">{translateLearningRule(rule, "en")}</p>
                        <p className="text-xs opacity-40 mt-0.5">Active globally — injected into every AI response</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Top complaints */}
            <Section title="Top complaints" icon="🚨">
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  {topComplaints.length === 0 ? (
                    <p className="text-sm opacity-40">No complaint patterns detected yet.</p>
                  ) : (
                    <div>
                      {topComplaints.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                          <div className="w-5 text-xs opacity-30 mono">{i + 1}</div>
                          <span className="text-sm flex-1">{c.keyword}</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 rounded-full bg-white/10 w-16 overflow-hidden">
                              <div className="h-full bg-red-400/60 rounded-full" style={{ width: `${Math.min(100, c.count * 20)}%` }} />
                            </div>
                            <span className="text-xs opacity-50 mono w-8 text-right">{c.count}x</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">User languages detected</p>
                  {Object.entries(languageCounts).sort((a, b) => b[1] - a[1]).map(([lang, count]) => (
                    <div key={lang} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm flex-1">{lang}</span>
                      <span className="text-xs opacity-50 mono">{count}</span>
                    </div>
                  ))}
                  {Object.keys(languageCounts).length === 0 && <p className="text-sm opacity-40">No messages yet</p>}
                </Card>
              </div>
            </Section>
          </div>
        )}

        {/* ── AI LEARNING ───────────────────────────────────────────────────── */}
        {activeSection === "learning" && (
          <div>
            <Section title="AI learning status" icon="🧠">
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">Learning pool</p>
                  <Row label="Total signals" value={learningPool.length} />
                  <Row label="Style signals" value={learningPool.filter(f => inferLearningType(f) === "style").length} />
                  <Row label="Content signals" value={learningPool.filter(f => inferLearningType(f) === "content").length} />
                  <Row label="From feedback" value={learningIdeas.length} />
                  <Row label="From improvement" value={improve.length} />
                  <Row label="From negative" value={neg.length} />
                </Card>
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">Style pressure</p>
                  {[
                    { label: "Shorter answers", count: improve.filter(f => /korter|shorter|te lang|too long/.test(`${f.userMessage||""} ${f.message||""}`.toLowerCase())).length },
                    { label: "Clearer wording", count: improve.filter(f => /duidelijker|clearer|onduidelijk|unclear/.test(`${f.userMessage||""} ${f.message||""}`.toLowerCase())).length },
                    { label: "Better structure", count: improve.filter(f => /structuur|structure/.test(`${f.userMessage||""} ${f.message||""}`.toLowerCase())).length },
                    { label: "Less vague", count: improve.filter(f => /vaag|vague/.test(`${f.userMessage||""} ${f.message||""}`.toLowerCase())).length },
                    { label: "More casual", count: improve.filter(f => /formeel|formal|natural|spontaner/.test(`${f.userMessage||""} ${f.message||""}`.toLowerCase())).length },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                      <span className="text-sm flex-1">{s.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full bg-white/10 w-12 overflow-hidden">
                          <div className="h-full bg-blue-400/60 rounded-full" style={{ width: `${Math.min(100, s.count * 25)}%` }} />
                        </div>
                        <span className={`text-xs mono w-4 ${s.count >= 3 ? "text-blue-400" : "opacity-40"}`}>{s.count}</span>
                      </div>
                    </div>
                  ))}
                </Card>
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">Active rules</p>
                  {activeLearningRules.length === 0 ? (
                    <p className="text-sm opacity-40">No rules active yet</p>
                  ) : activeLearningRules.map((rule, i) => (
                    <div key={i} className="flex gap-2 py-2 border-b border-white/5 last:border-0">
                      <span className="text-emerald-400 text-xs mt-0.5">●</span>
                      <span className="text-sm">{rule}</span>
                    </div>
                  ))}
                </Card>
              </div>
            </Section>

            <Section title="Saved learning insights" icon="💡">
              <div className="space-y-2">
                {learningIdeas.length === 0 && <Card><p className="text-sm opacity-40">No learning insights saved yet.</p></Card>}
                {learningIdeas.slice(0, 20).map((f, i) => (
                  <div key={i} className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 flex items-start gap-3">
                    <span className="text-xs opacity-30 mono mt-0.5 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{f.message}</p>
                      <div className="flex gap-2 mt-1.5">
                        <Badge label={f.userMessage === "Auto learning insight" ? "Auto" : "Manual"} color="bg-white/8 text-white/50" />
                        <Badge label={inferLearningType(f)} color={inferLearningType(f) === "style" ? "bg-purple-500/15 text-purple-400" : "bg-cyan-500/15 text-cyan-400"} />
                        {f.timestamp && <span className="text-xs opacity-25">{new Date(f.timestamp).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── SIGNALS ──────────────────────────────────────────────────────── */}
        {activeSection === "signals" && (
          <div>
            <Section title="Implicit conversation signals" icon="🔍">
              <p className="text-xs opacity-40 mb-4">Detected automatically from conversation behavior — no thumbs required.</p>
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Card className="border-teal-500/15">
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-2">🔁 Reformulations</p>
                  <p className="text-3xl font-bold mono text-teal-400">{reformulations.length}</p>
                  <p className="text-xs opacity-40 mt-2">User rephrased the same question — previous answer was unclear or unhelpful</p>
                </Card>
                <Card className="border-blue-500/15">
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-2">💬 Follow-up depth</p>
                  <p className="text-3xl font-bold mono text-blue-400">{followups.length}</p>
                  <p className="text-xs opacity-40 mt-2">User asked a follow-up — previous answer was incomplete</p>
                </Card>
                <Card className="border-emerald-500/15">
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-2">⏱️ Long sessions</p>
                  <p className="text-3xl font-bold mono text-emerald-400">{longSessions.length}</p>
                  <p className="text-xs opacity-40 mt-2">User stayed engaged — AI quality was strong</p>
                </Card>
              </div>

              {qualityScore !== null && (
                <Card className="mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs opacity-40 uppercase tracking-widest mb-1">Session quality score</p>
                      <p className="text-2xl font-bold mono">{qualityScore}%</p>
                      <p className="text-xs opacity-40 mt-1">Long sessions ÷ (long sessions + reformulations) — higher is better</p>
                    </div>
                    <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center" style={{ borderColor: qualityScore >= 70 ? "#34d399" : qualityScore >= 50 ? "#fbbf24" : "#f87171" }}>
                      <span className="text-lg font-bold mono">{qualityScore}%</span>
                    </div>
                  </div>
                </Card>
              )}
            </Section>

            <Section title="Auto Debug signals" icon="🤖">
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">By type</p>
                  <Row label="Casual mismatch" value={debugSignals.casualMismatch} />
                  <Row label="Search miss" value={debugSignals.searchMiss} />
                  <Row label="Image context miss" value={debugSignals.imageMiss} />
                  <Row label="Verbose image route" value={debugSignals.verbose} />
                  <Row label="Reformulation" value={reformulations.length} />
                  <Row label="Follow-up depth" value={followups.length} />
                </Card>
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">By confidence</p>
                  <Row label="High" value={debugSignals.highConf} accent="text-red-400" />
                  <Row label="Medium" value={debugSignals.medConf} accent="text-yellow-400" />
                  <Row label="Low" value={debugSignals.lowConf} accent="text-blue-400" />
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <Row label="Style signals" value={autoDebug.filter(f => inferLearningType(f) === "style").length} />
                    <Row label="Content signals" value={autoDebug.filter(f => inferLearningType(f) === "content").length} />
                  </div>
                </Card>
              </div>
            </Section>
          </div>
        )}

        {/* ── WORKFLOW ──────────────────────────────────────────────────────── */}
        {activeSection === "workflow" && (
          <div>
            <Section title="Idea & bug workflow" icon="🗂️">
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">🐞 Bugs</p>
                  <p className="text-3xl font-bold mono text-red-400 mb-3">{bugs.length}</p>
                  <Row label="New" value={bugNewCount} accent="text-blue-400" />
                  <Row label="In progress" value={bugBezigCount} accent="text-yellow-400" />
                  <Row label="Done" value={bugDoneCount} accent="text-emerald-400" />
                </Card>
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">🔧 Adjustments</p>
                  <p className="text-3xl font-bold mono text-orange-400 mb-3">{adjustments.length}</p>
                  <Row label="New" value={adjustments.filter(f => getResolvedStatus(f) === "nieuw").length} accent="text-blue-400" />
                  <Row label="In progress" value={adjustments.filter(f => getResolvedStatus(f) === "bezig").length} accent="text-yellow-400" />
                  <Row label="Done" value={adjustments.filter(f => getResolvedStatus(f) === "klaar").length} accent="text-emerald-400" />
                </Card>
                <Card>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">🧠 AI feedback</p>
                  <p className="text-3xl font-bold mono text-green-400 mb-3">{learningIdeas.length}</p>
                  <Row label="Auto insights" value={learningIdeas.filter(f => f.userMessage === "Auto learning insight").length} />
                  <Row label="Manual actions" value={learningIdeas.filter(f => f.userMessage === "AI insight action").length} />
                  <Row label="User submitted" value={learningIdeas.filter(f => f.userMessage !== "Auto learning insight" && f.userMessage !== "AI insight action").length} />
                </Card>
              </div>

              {/* Bug list */}
              {bugs.length > 0 && (
                <div>
                  <p className="text-xs opacity-40 uppercase tracking-widest mb-3">Open bugs</p>
                  <div className="space-y-2">
                    {bugs.filter(f => getResolvedStatus(f) !== "klaar").map((f, i) => {
                      const key = getItemKey(f);
                      const status = getResolvedStatus(f);
                      return (
                        <div key={i} className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
                          <span className="text-red-400 text-xs">🐞</span>
                          <p className="text-sm flex-1">{f.message || f.userMessage}</p>
                          <select value={status} onChange={e => updateStatus(key, e.target.value)} className="text-xs px-2 py-1 rounded-lg bg-white/8 border border-white/10 text-white [&>option]:text-black">
                            <option value="nieuw">New</option>
                            <option value="bezig">In progress</option>
                            <option value="klaar">Done</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}

        {/* ── FEED ──────────────────────────────────────────────────────────── */}
        {activeSection === "feed" && (
          <div>
            <Section title="Feedback feed" icon="📋">
              <p className="text-xs opacity-40 mb-4">{feedback.length} items total · sorted by newest</p>
              {feedback.length === 0 && <Card><p className="text-sm opacity-40">No feedback yet.</p></Card>}
              <div className="space-y-2">
                {feedback.slice(0, 100).map((f, i) => {
                  const key = getItemKey(f);
                  const status = getResolvedStatus(f);
                  const typeColor = f.type === "up" ? "text-emerald-400" : f.type === "down" ? "text-red-400" : f.type === "auto_debug" ? "text-purple-400" : f.type === "idea" ? "text-blue-400" : "text-yellow-400";
                  const typeLabel = f.type === "up" ? "👍 Positive" : f.type === "down" ? "👎 Negative" : f.type === "auto_debug" ? "🤖 Auto Debug" : f.type === "idea" ? (f.source === "idea_bug" ? "🐞 Bug" : f.source === "idea_feedback_learning" ? "🧠 Learning" : "💡 Idea") : "🛠️ Improve";

                  return (
                    <div key={i} className="bg-white/4 border border-white/8 rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className={`text-xs font-medium ${typeColor}`}>{typeLabel}</span>
                        <div className="flex items-center gap-2">
                          <select value={status} onChange={e => updateStatus(key, e.target.value)} className="text-xs px-2 py-1 rounded-lg bg-white/8 border border-white/10 text-white [&>option]:text-black">
                            <option value="nieuw">New</option>
                            <option value="bezig">In progress</option>
                            <option value="klaar">Done</option>
                          </select>
                          {f.timestamp && <span className="text-xs opacity-25 mono">{new Date(f.timestamp).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <p className="text-sm opacity-80">
                        {f.type === "auto_debug" || f.type === "improve" || f.type === "idea" ? f.message : f.userMessage}
                      </p>
                      {f.type !== "improve" && f.type !== "idea" && f.type !== "auto_debug" && f.message && (
                        <p className="text-xs opacity-40 mt-1.5">AI: {f.message.slice(0, 120)}{f.message.length > 120 ? "…" : ""}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        )}

      </div>
    </main>
  );
}