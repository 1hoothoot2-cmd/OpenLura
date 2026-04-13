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

  useEffect(() => {
    if (auth !== null && !auth.authenticated) router.replace("/");
  }, [auth, router]);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      if (res.status === 401) { router.push("/"); return; }
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
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  const isPro = tier === "pro" || tier === "admin";
  const greeting = userName ? `Welcome back, ${userName.split(" ")[0]}` : "Your workspace";

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#7c3aed] flex items-center justify-center">
            <span className="text-[13px] font-bold text-white">O</span>
          </div>
          <span className="text-sm font-semibold text-white/90">OpenLura</span>
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
      <div className="mx-auto w-full max-w-2xl px-5 pt-10 pb-24 sm:px-6 sm:pt-14">

        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white/92 sm:text-3xl">{greeting}</h1>
          <p className="mt-1.5 text-sm text-white/44">
            {isPro ? "Full access — all tools available." : "Free plan — some tools are locked."}
          </p>
        </div>

        {/* Primary tool cards */}
        <div className="grid gap-3 sm:gap-4">

          {/* Chat */}
          <Link
            href="/personal-workspace/chat"
            className="group relative flex items-center gap-4 rounded-[20px] border border-[#3b82f6]/22 bg-gradient-to-r from-[#0d1733]/80 to-[#0a1022]/80 px-5 py-5 backdrop-blur-xl transition-[border-color,box-shadow] duration-150 hover:border-[#3b82f6]/40 hover:shadow-[0_8px_28px_rgba(29,78,216,0.18)] active:scale-[0.99] sm:px-6 sm:py-6"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1d4ed8]/30 to-[#3b82f6]/20 border border-[#3b82f6]/20 text-2xl">
              💬
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-white/92">Chat</span>
                <span className="inline-flex items-center rounded-full border border-emerald-400/16 bg-emerald-400/8 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80">Free</span>
              </div>
              <p className="mt-0.5 text-sm text-white/44 truncate">Ask, write, plan — AI at your fingertips</p>
            </div>
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/24 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          </Link>

          {/* Brain */}
          {isPro ? (
            <Link
              href="/brain"
              className="group relative flex items-center gap-4 rounded-[20px] border border-purple-400/20 bg-gradient-to-r from-[#120d24]/80 to-[#0d0b1a]/80 px-5 py-5 backdrop-blur-xl transition-[border-color,box-shadow] duration-150 hover:border-purple-400/36 hover:shadow-[0_8px_28px_rgba(124,58,237,0.16)] active:scale-[0.99] sm:px-6 sm:py-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/14 border border-purple-400/18 text-2xl">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white/92">Brain</span>
                  <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">Go ✦</span>
                </div>
                <p className="mt-0.5 text-sm text-white/44 truncate">Upload docs, notebooks, AI insights</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/24 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleUpgrade}
              className="group relative flex items-center gap-4 rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 text-left opacity-70 transition-[opacity,border-color] duration-150 hover:border-white/14 hover:opacity-90 active:scale-[0.99] sm:px-6 sm:py-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-2xl grayscale">
                🧠
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white/60">Brain</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/80">Upgrade ✦</span>
                </div>
                <p className="mt-0.5 text-sm text-white/32 truncate">Upload docs, notebooks, AI insights</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </button>
          )}

          {/* Photo Studio */}
          {isPro ? (
            <Link
              href="/photo-studio"
              className="group relative flex items-center gap-4 rounded-[20px] border border-pink-400/18 bg-gradient-to-r from-[#1a0d18]/80 to-[#0f0b14]/80 px-5 py-5 backdrop-blur-xl transition-[border-color,box-shadow] duration-150 hover:border-pink-400/32 hover:shadow-[0_8px_28px_rgba(236,72,153,0.12)] active:scale-[0.99] sm:px-6 sm:py-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/16 to-rose-600/10 border border-pink-400/16 text-2xl">
                🎨
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white/92">Photo Studio</span>
                  <span className="inline-flex items-center rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">Go ✦</span>
                </div>
                <p className="mt-0.5 text-sm text-white/44 truncate">Generate & edit images with AI</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/24 group-hover:text-pink-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleUpgrade}
              className="group relative flex items-center gap-4 rounded-[20px] border border-white/8 bg-white/[0.02] px-5 py-5 text-left opacity-70 transition-[opacity,border-color] duration-150 hover:border-white/14 hover:opacity-90 active:scale-[0.99] sm:px-6 sm:py-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-2xl grayscale">
                🎨
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white/60">Photo Studio</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/20 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/80">Upgrade ✦</span>
                </div>
                <p className="mt-0.5 text-sm text-white/32 truncate">Generate & edit images with AI</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            </button>
          )}
        </div>

        {/* Upgrade banner — free users only */}
        {!isPro && (
          <div className="mt-6 rounded-[20px] border border-amber-400/16 bg-gradient-to-r from-amber-400/6 to-orange-400/4 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/88">Unlock the full workspace</p>
                <p className="mt-1 text-sm text-white/46">Brain, Photo Studio, unlimited chat + memory — all in one plan.</p>
                <ul className="mt-3 space-y-1.5">
                  {["Unlimited messages", "Brain — docs & AI insights", "Photo Studio — AI images", "Personal AI memory"].map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/70 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="mt-4 w-full rounded-[14px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] py-3 text-sm font-semibold text-black shadow-[0_6px_16px_rgba(245,158,11,0.22)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60"
            >
              {upgradeLoading ? "Loading…" : "Upgrade to Go ✦"}
            </button>
          </div>
        )}

        {/* Pro quick tip */}
        {isPro && (
          <div className="mt-6 rounded-[20px] border border-blue-400/14 bg-blue-400/[0.04] px-5 py-4 sm:px-6">
            <p className="text-sm text-white/50">
              <span className="font-medium text-blue-300">Go plan active.</span> All tools unlocked. Use Brain to build your knowledge base and Photo Studio for AI images.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}