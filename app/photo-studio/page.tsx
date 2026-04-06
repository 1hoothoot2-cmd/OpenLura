"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PhotoStudioPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch("/api/auth", { method: "GET", credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (!d?.authenticated) { router.replace("/personal-workspace"); return; }
        setAuthChecked(true);
      })
      .catch(() => router.replace("/personal-workspace"));
  }, []);

  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white">
        <p className="text-white/40 text-sm">Laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-white flex flex-col items-center justify-center px-4">
      <div className="text-5xl mb-6">🎨</div>
      <h1 className="text-2xl font-semibold text-white/90 mb-2">Photo Studio</h1>
      <p className="text-sm text-white/40 mb-8">AI image generation komt hier. Fase 5.2 →</p>
      <button
        type="button"
        onClick={() => router.push("/personal-dashboard")}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        ← Terug naar dashboard
      </button>
    </div>
  );
}