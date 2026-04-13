"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PersonalWorkspacePage() {
  const router = useRouter();
  const [auth, setAuth] = useState<null | { authenticated: boolean; userId?: string }>(null);
  const [tier, setTier] = useState<"free" | "pro" | "admin">("free");
  const [userName, setUserName] = useState<string | null>(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("plan") === "1") {
      setShowPlanModal(true);
      window.history.replaceState({}, "", "/personal-workspace");
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("ol_login_redirect", "/personal-workspace");
      }
    } catch {}

    async function initAuth() {
      try {
        let res = await fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" });
        let data = await res.json().catch(() => null);

        if (!data?.authenticated) {
          await fetch("/api/auth?action=refresh", { method: "GET", credentials: "same-origin", cache: "no-store" }).catch(() => null);
          res = await fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" });
          data = await res.json().catch(() => null);
        }

        setAuth({
          authenticated: !!data?.authenticated,
          userId: typeof data?.runtime?.userId === "string" ? data.runtime.userId : undefined,
        });

        if (data?.authenticated) {
          // Load tier + name from personal state
          const sd = await fetch("/api/personal-state", { method: "GET", credentials: "same-origin", cache: "no-store" })
            .then(r => r.json()).catch(() => null);
          const t = sd?.usageStats?.tier || sd?.usage_stats?.tier;
          if (t === "pro" || t === "admin") setTier(t);
          const n = sd?.profile?.name || sd?.name || data?.runtime?.email?.split("@")[0] || null;
          if (n) setUserName(n);
        }
      } catch {
        setAuth({ authenticated: false });
      }
    }

    initAuth();
  }, []);

  async function handleUpgrade() {
    // Must be logged in before going to Stripe
    if (!auth?.authenticated) {
      window.location.href = "/?login=1";
      return;
    }
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      if (res.status === 401) { window.location.href = "/?login=1"; return; }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {} finally {
      setUpgradeLoading(false);
    }
  }

  if (auth === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#07070f] px-5">
        <div className="mb-6 h-10 w-10 rounded-2xl overflow-hidden border border-white/10 bg-white/[0.04]">
          <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
        </div>
        <h1 className="text-xl font-semibold text-white/92 mb-2 text-center">Your workspace awaits</h1>
        <p className="text-sm text-white/44 text-center mb-8 max-w-xs">Sign in or create a free account to access your personal AI workspace.</p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a href="/?login=1" className="w-full rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-3.5 text-sm font-semibold text-white text-center shadow-[0_6px_16px_rgba(59,130,246,0.28)] transition-[filter] hover:brightness-110">
            Sign in
          </a>
          <a href="/?login=1" className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] py-3.5 text-sm font-medium text-white/80 text-center transition-[background-color,border-color] hover:bg-white/[0.08] hover:text-white">
            Create free account
          </a>
        </div>
      </div>
    );
  }

  const isPro = tier === "pro" || tier === "admin";
  const firstName = userName ? userName.split(" ")[0] : null;

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] flex items-center justify-center">
            <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white/90">OpenLura</span>
            <p className="text-[10px] text-white/32 uppercase tracking-widest leading-none mt-0.5">Personal Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPro ? (
            <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">Go ✦</span>
          ) : (
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-400/16 disabled:opacity-60"
            >
              {upgradeLoading ? "…" : "Upgrade to Go ✦"}
            </button>
          )}
          <Link
            href="/"
            className="h-7 w-7 flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.07] transition-all"
            title="Home"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-4xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">

        {/* Greeting header — image 2 style */}
        <div className="mb-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/32 mb-1">{getGreeting()}</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            {firstName ? (
              <>{firstName} <span className="text-white/50">👋</span></>
            ) : (
              "Your workspace"
            )}
          </h1>
          <p className="mt-1.5 text-sm text-white/40">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <p className="mt-1 text-sm text-white/32">
            {isPro ? "Go plan — full access" : "Free plan — some tools are locked."}
          </p>
        </div>

        {/* Tool cards grid — image 2 style: 2-col on desktop, 1-col on mobile */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">

          {/* Chat */}
          <Link
            href="/personal-workspace/chat"
            className="group flex items-start gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-5 transition-[border-color,background-color] duration-150 hover:border-white/14 hover:bg-white/[0.05] active:scale-[0.99] sm:p-6"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a5f]/60 border border-[#3b82f6]/20 text-xl">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white/90">Chat</span>
                <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80">Free</span>
              </div>
              <p className="text-sm text-white/40">Open your AI workspace</p>
            </div>
          </Link>

          {/* Brain */}
          {isPro ? (
            <Link
              href="/brain"
              className="group flex items-start gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-5 transition-[border-color,background-color] duration-150 hover:border-white/14 hover:bg-white/[0.05] active:scale-[0.99] sm:p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#2d1b69]/50 border border-purple-400/18 text-xl">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/90">Brain</span>
                  <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">Go ✦</span>
                </div>
                <p className="text-sm text-white/40">Your AI knowledge base</p>
              </div>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="flex items-start gap-4 rounded-[18px] border border-white/6 bg-white/[0.02] p-5 text-left transition-[border-color] duration-150 hover:border-white/10 active:scale-[0.99] sm:p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-xl grayscale opacity-50">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/40">Brain</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/18 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/70">Upgrade ✦</span>
                </div>
                <p className="text-sm text-white/28">Your AI knowledge base</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </button>
          )}

          {/* Photo Studio */}
          {isPro ? (
            <Link
              href="/photo-studio"
              className="group flex items-start gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-5 transition-[border-color,background-color] duration-150 hover:border-white/14 hover:bg-white/[0.05] active:scale-[0.99] sm:p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#4a1040]/50 border border-pink-400/16 text-xl">
                🎨
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/90">Photo Studio</span>
                  <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">Go ✦</span>
                </div>
                <p className="text-sm text-white/40">Generate images with AI</p>
              </div>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="flex items-start gap-4 rounded-[18px] border border-white/6 bg-white/[0.02] p-5 text-left transition-[border-color] duration-150 hover:border-white/10 active:scale-[0.99] sm:p-6"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-xl grayscale opacity-50">
                🎨
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/40">Photo Studio</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/18 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/70">Upgrade ✦</span>
                </div>
                <p className="text-sm text-white/28">Generate images with AI</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </button>
          )}

          {/* Subscription card */}
          <button
            type="button"
            onClick={() => setShowPlanModal(true)}
            className="group flex items-start gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-5 text-left transition-[border-color,background-color] duration-150 hover:border-white/14 hover:bg-white/[0.05] active:scale-[0.99] sm:p-6"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1a3a2a]/60 border border-emerald-400/16 text-xl">
              💳
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white/90 block mb-1">Subscription</span>
              <p className="text-sm text-white/40">Manage your plan</p>
            </div>
          </button>
        </div>

        {/* Upgrade banner — free users only */}
        {!isPro && (
          <div className="mt-6 rounded-[20px] border border-amber-400/14 bg-white/[0.02] px-5 py-5 sm:px-6">
            <p className="text-sm font-semibold text-white/80 mb-1">Unlock the full workspace</p>
            <p className="text-sm text-white/40 mb-4">Brain, Photo Studio, unlimited chat + memory — all in one plan.</p>
            <ul className="space-y-2 mb-5">
              {["Unlimited messages", "Brain — docs & AI insights", "Photo Studio — AI images", "Personal AI memory"].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/52">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="w-full rounded-[14px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] py-3.5 text-sm font-semibold text-black shadow-[0_6px_20px_rgba(245,158,11,0.20)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
            >
              {upgradeLoading ? "Loading…" : "Upgrade to Go ✦"}
            </button>
          </div>
        )}

        {/* Pro active tip */}
        {isPro && (
          <div className="mt-6 rounded-[18px] border border-blue-400/12 bg-blue-400/[0.03] px-5 py-4">
            <p className="text-sm text-white/46">
              <span className="font-medium text-blue-300/80">Go plan active.</span> All tools unlocked — Brain, Photo Studio, unlimited chat.
            </p>
          </div>
        )}
      </div>

      {/* Plan modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPlanModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0c0c18] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.60)]">
            <button
              type="button"
              onClick={() => setShowPlanModal(false)}
              className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full border border-white/8 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              ×
            </button>

            <h2 className="text-base font-semibold text-white/92 mb-1">Your plan</h2>

            {/* Current plan badge */}
            <div className="mb-5">
              {isPro ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-sm font-medium text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  Go plan — active
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-medium text-white/60">
                  <span className="h-2 w-2 rounded-full bg-white/30" />
                  Free plan
                </div>
              )}
            </div>

            {/* Feature list */}
            <ul className="space-y-2.5 mb-6">
              {[
                { label: "Chat", free: true },
                { label: "Unlimited messages", free: false },
                { label: "Personal AI memory", free: false },
                { label: "Brain — docs & AI insights", free: false },
                { label: "Photo Studio — AI images", free: false },
                { label: "Web search", free: false },
              ].map(f => (
                <li key={f.label} className="flex items-center gap-2.5">
                  {f.free || isPro ? (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  )}
                  <span className={`text-sm ${f.free || isPro ? "text-white/72" : "text-white/28"}`}>{f.label}</span>
                </li>
              ))}
            </ul>

            {/* Actions */}
            {isPro ? (
              <button
                type="button"
                disabled={portalLoading}
                onClick={async () => {
                  setPortalLoading(true);
                  try {
                    const res = await fetch("/api/stripe/portal", { method: "POST", credentials: "include" });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch {} finally { setPortalLoading(false); }
                }}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] py-3 text-sm font-medium text-white/70 transition-[background-color,border-color] hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
              >
                {portalLoading ? "Loading…" : "Manage / cancel subscription →"}
              </button>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => { setShowPlanModal(false); handleUpgrade(); }}
                  disabled={upgradeLoading}
                  className="w-full rounded-[14px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] py-3 text-sm font-semibold text-black shadow-[0_6px_16px_rgba(245,158,11,0.20)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
                >
                  {upgradeLoading ? "Loading…" : "Upgrade to Go ✦"}
                </button>
                <p className="text-center text-[11px] text-white/28">Includes Brain, Photo Studio, unlimited chat & memory</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}