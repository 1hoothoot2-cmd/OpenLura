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
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginTab, setLoginTab] = useState<"login" | "register">("login");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);

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
    if (!auth?.authenticated) {
      setShowPlanModal(false);
      setShowLoginModal(true);
      return;
    }
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      if (res.status === 401) { setShowLoginModal(true); return; }
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {} finally {
      setUpgradeLoading(false);
    }
  }

  async function handleLoginThenStripe() {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "login", username: loginEmail.trim(), password: loginPassword }),
      });
      if (!res.ok) { setLoginError("Invalid email or password."); return; }
      setShowLoginModal(false);
      // Now go to Stripe
      const stripe = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      const data = await stripe.json();
      if (data.url) window.location.href = data.url;
    } catch { setLoginError("Something went wrong."); } finally { setLoginLoading(false); }
  }

  async function handleRegisterThenStripe() {
    setRegisterLoading(true);
    setRegisterError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "register", username: registerEmail.trim(), password: registerPassword, name: registerName.trim() }),
      });
      if (!res.ok) { setRegisterError("Registration failed. Try a different email."); return; }
      setShowLoginModal(false);
      const stripe = await fetch("/api/stripe/checkout", { method: "POST", credentials: "include" });
      const data = await stripe.json();
      if (data.url) window.location.href = data.url;
    } catch { setRegisterError("Something went wrong."); } finally { setRegisterLoading(false); }
  }

  if (auth === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510]">
        <div className="h-5 w-5 rounded-full border-2 border-[#3b82f6]/30 border-t-[#3b82f6] animate-spin" />
      </div>
    );
  }

  if (!auth.authenticated) {
    // Free users land here — show workspace home with limited access
    // No forced login for free chat
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
              <p className="text-[10px] text-white/32 uppercase tracking-widest leading-none mt-0.5">Workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/?login=1" className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white">
              Sign in
            </a>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl px-5 pt-10 pb-24 sm:px-8 sm:pt-14">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">Your workspace</h1>
            <p className="mt-1.5 text-sm text-white/40">Free plan — sign in to unlock your personal workspace.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {/* Chat — free, no login needed */}
            <Link href="/chat" className="group flex items-start gap-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-5 transition-[border-color,background-color] duration-150 hover:border-white/14 hover:bg-white/[0.05] active:scale-[0.99] sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a5f]/60 border border-[#3b82f6]/20 text-xl">💬</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/90">Chat</span>
                  <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80">Free</span>
                </div>
                <p className="text-sm text-white/40">Start chatting without an account</p>
              </div>
            </Link>

            {/* Brain — locked, requires sign in */}
            <a href="/?login=1" className="flex items-start gap-4 rounded-[18px] border border-white/6 bg-white/[0.02] p-5 text-left transition-[border-color] duration-150 hover:border-white/10 active:scale-[0.99] sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-xl grayscale opacity-50">🧠</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/40">Brain</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/18 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/70">Sign in ✦</span>
                </div>
                <p className="text-sm text-white/28">Your AI knowledge base</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </a>

            {/* Photo Studio — locked */}
            <a href="/?login=1" className="flex items-start gap-4 rounded-[18px] border border-white/6 bg-white/[0.02] p-5 text-left transition-[border-color] duration-150 hover:border-white/10 active:scale-[0.99] sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/8 text-xl grayscale opacity-50">🎨</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white/40">Photo Studio</span>
                  <span className="inline-flex items-center rounded-full border border-amber-400/18 bg-amber-400/8 px-2 py-0.5 text-[10px] font-medium text-amber-300/70">Sign in ✦</span>
                </div>
                <p className="text-sm text-white/28">Generate images with AI</p>
              </div>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-white/16 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </a>

            {/* Sign in card */}
            <a href="/?login=1" className="group flex items-start gap-4 rounded-[18px] border border-[#3b82f6]/16 bg-[#0d1733]/60 p-5 text-left transition-[border-color,background-color] duration-150 hover:border-[#3b82f6]/30 hover:bg-[#0d1733]/80 active:scale-[0.99] sm:p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#1e3a5f]/60 border border-[#3b82f6]/20 text-xl">🔑</div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-white/90 block mb-1">Sign in / Create account</span>
                <p className="text-sm text-white/40">Unlock your personal AI workspace</p>
              </div>
            </a>
          </div>
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

      {/* Login modal — shown before Stripe for unauthenticated users */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLoginModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0c0c18] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.60)]">
            <button type="button" onClick={() => setShowLoginModal(false)}
              className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full border border-white/8 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">×</button>

            <h2 className="text-base font-semibold text-white/92 mb-1">Sign in to upgrade</h2>
            <p className="text-sm text-white/44 mb-5">Create an account or sign in, then complete your upgrade.</p>

            {/* Tabs */}
            <div className="flex rounded-[14px] border border-white/8 bg-white/[0.03] p-1 mb-5">
              <button type="button" onClick={() => setLoginTab("login")}
                className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-colors ${loginTab === "login" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"}`}>
                Sign in
              </button>
              <button type="button" onClick={() => setLoginTab("register")}
                className={`flex-1 rounded-[10px] py-2 text-[13px] font-medium transition-colors ${loginTab === "register" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/70"}`}>
                Create account
              </button>
            </div>

            {/* Google */}
            <button type="button"
              onClick={() => {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                if (!supabaseUrl) return;
                try { sessionStorage.setItem("ol_after_login_stripe", "1"); } catch {}
                const redirectTo = `${window.location.origin}/auth/callback`;
                window.location.href = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
              }}
              className="flex w-full items-center justify-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/88 transition-colors hover:bg-white/[0.09] mb-4">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-white/8" /><span className="text-[11px] text-white/28">or</span><div className="h-px flex-1 bg-white/8" />
            </div>

            {loginTab === "login" ? (
              <div className="space-y-2.5">
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="Email" className="w-full rounded-[12px] border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16" />
                <input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Password" className="w-full rounded-[12px] border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16" />
                {loginError && <p className="text-sm text-red-400">{loginError}</p>}
                <button type="button" onClick={handleLoginThenStripe} disabled={loginLoading || !loginEmail.trim() || !loginPassword}
                  className="w-full rounded-[12px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] py-2.5 text-sm font-semibold text-black transition-[filter,opacity] hover:brightness-110 disabled:opacity-50">
                  {loginLoading ? "Signing in…" : "Sign in & upgrade →"}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <input type="text" value={registerName} onChange={e => setRegisterName(e.target.value)}
                  placeholder="Your name" className="w-full rounded-[12px] border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16" />
                <input type="email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)}
                  placeholder="Email" className="w-full rounded-[12px] border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16" />
                <input type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)}
                  placeholder="Password" className="w-full rounded-[12px] border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16" />
                {registerError && <p className="text-sm text-red-400">{registerError}</p>}
                <button type="button" onClick={handleRegisterThenStripe} disabled={registerLoading || !registerEmail.trim() || !registerPassword}
                  className="w-full rounded-[12px] bg-gradient-to-r from-[#d97706] to-[#f59e0b] py-2.5 text-sm font-semibold text-black transition-[filter,opacity] hover:brightness-110 disabled:opacity-50">
                  {registerLoading ? "Creating account…" : "Create account & upgrade →"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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