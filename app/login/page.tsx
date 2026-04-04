"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) { setError(data?.error || "Login mislukt"); return; }
      router.replace("/personal-workspace");
    } catch { setError("Login mislukt"); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError(""); setSuccess("");
    if (!email.trim()) { setError("Vul een e-mailadres in"); return; }
    if (!password) { setError("Vul een wachtwoord in"); return; }
    if (password.length < 6) { setError("Wachtwoord minimaal 6 tekens"); return; }
    if (password !== passwordConfirm) { setError("Wachtwoorden komen niet overeen"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "signup", email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) { setError(data?.error || "Registratie mislukt"); return; }
      if (data.requiresConfirmation) { setSuccess("Controleer je e-mail om je account te bevestigen."); return; }
      router.replace("/personal-workspace");
    } catch { setError("Registratie mislukt"); }
    finally { setLoading(false); }
  };

  const googleLogin = () => {
    window.location.href = `https://imhapciqxtkuefgxkwyv.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin + "/auth/callback")}`;
  };

  return (
    <main className="fixed inset-0 flex items-center justify-center bg-[#050510] px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] border border-[#3b82f6]/18 bg-[radial-gradient(circle_at_30%_30%,rgba(96,165,250,0.16),rgba(29,78,216,0.06)_52%,transparent_78%)]">
            <img src="/openlura-logo.png" alt="OpenLura" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white/94">OpenLura</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/36">Adaptive AI workspace</div>
          </div>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#0b1020]/95 shadow-[0_22px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl">

          {/* Tabs */}
          <div className="flex border-b border-white/8">
            <button type="button"
              onClick={() => { setTab("login"); setError(""); setSuccess(""); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors duration-150 ${tab === "login" ? "text-white border-b-2 border-[#3b82f6]" : "text-white/40 hover:text-white/70"}`}
            >Inloggen</button>
            <button type="button"
              onClick={() => { setTab("register"); setError(""); setSuccess(""); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors duration-150 ${tab === "register" ? "text-white border-b-2 border-[#3b82f6]" : "text-white/40 hover:text-white/70"}`}
            >Registreren</button>
          </div>

          <div className="p-6">
            {/* Google knop */}
            <button type="button" onClick={googleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/88 transition-[background-color,border-color] duration-200 hover:border-white/16 hover:bg-white/[0.07]"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Doorgaan met Google
            </button>

            <div className="relative flex items-center gap-3 py-4">
              <div className="h-px flex-1 bg-white/8" />
              <span className="text-[11px] text-white/28">of</span>
              <div className="h-px flex-1 bg-white/8" />
            </div>

            {tab === "login" ? (
              <div className="space-y-3">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mailadres" type="email"
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Wachtwoord"
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]"
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleLogin(); }} />
                {error && <p className="rounded-xl border border-red-400/16 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">{error}</p>}
                <button type="button" onClick={handleLogin} disabled={loading}
                  className="w-full rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] p-3 text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60">
                  {loading ? "Inloggen..." : "Inloggen"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mailadres" type="email"
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Wachtwoord (min. 6 tekens)"
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]" />
                <input type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="Herhaal wachtwoord"
                  className="w-full rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-white/95 outline-none placeholder:text-white/30 transition-[border-color,background-color] duration-200 focus:border-white/14 focus:bg-white/[0.06]"
                  onKeyDown={(e) => { if (e.key === "Enter" && !loading) handleRegister(); }} />
                {error && <p className="rounded-xl border border-red-400/16 bg-red-500/[0.08] px-3 py-2 text-sm text-red-300">{error}</p>}
                {success && <p className="rounded-xl border border-emerald-400/16 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-300">{success}</p>}
                <button type="button" onClick={handleRegister} disabled={loading || !!success}
                  className="w-full rounded-[18px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] p-3 text-white shadow-[0_10px_24px_rgba(59,130,246,0.24)] transition-[filter,opacity] hover:brightness-110 disabled:opacity-60">
                  {loading ? "Account aanmaken..." : "Account aanmaken"}
                </button>
              </div>
            )}

            <p className="mt-4 text-center text-xs text-white/36">
              <a href="/" className="text-white/42 hover:text-white/70 transition-colors">← Terug naar home</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}