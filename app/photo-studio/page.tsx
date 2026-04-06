"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MODELS = [
  { id: "dalle3", label: "DALL-E 3", badge: "OpenAI", color: "emerald" },
  { id: "nano-banana", label: "Nano Banana", badge: "Snel", color: "blue" },
  { id: "nano-banana-2", label: "Nano Banana 2", badge: "Scherp", color: "purple" },
  { id: "nano-banana-pro", label: "Nano Banana Pro", badge: "Max", color: "amber" },
] as const;

type ModelId = typeof MODELS[number]["id"];

const BADGE_COLORS: Record<string, string> = {
  emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  blue: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  purple: "border-purple-400/20 bg-purple-400/10 text-purple-300",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
};

const RING_COLORS: Record<string, string> = {
  emerald: "ring-emerald-400/40 border-emerald-400/30",
  blue: "ring-blue-400/40 border-blue-400/30",
  purple: "ring-purple-400/40 border-purple-400/30",
  amber: "ring-amber-400/40 border-amber-400/30",
};

export default function PhotoStudioPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("nano-banana-2");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth", { method: "GET", credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (!d?.authenticated) { router.replace("/personal-workspace"); return; }
        setAuthChecked(true);
      })
      .catch(() => router.replace("/personal-workspace"));
  }, []);

  function handleReset() {
    setImageUrl(null);
    setPrompt("");
  }

  async function generate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);
    try {
      const res = await fetch("/api/image-generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data?.error || "Generatie mislukt"); return; }
      setImageUrl(data.url);
    } catch {
      setError("Verbindingsfout, probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white">
        <p className="text-white/40 text-sm">Laden...</p>
      </div>
    );
  }

  const activeModel = MODELS.find(m => m.id === model)!;

  return (
    <div className="min-h-screen bg-[#050510] text-white">
      {/* Header */}
      <div className="border-b border-white/6 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/personal-dashboard")}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div>
            <h1 className="text-sm font-semibold text-white/90">Photo Studio</h1>
            <p className="text-[11px] text-white/36">AI image generation</p>
          </div>
        </div>
        <span className="text-lg">🎨</span>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">

        {/* Model selector */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/32 mb-3">Model</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MODELS.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModel(m.id)}
                className={`rounded-[16px] border px-3 py-3 text-left transition-all duration-150 ${
                  model === m.id
                    ? `${RING_COLORS[m.color]} ring-1 bg-white/[0.05]`
                    : "border-white/8 bg-white/[0.025] hover:bg-white/[0.04] hover:border-white/14"
                }`}
              >
                <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium mb-2 ${BADGE_COLORS[m.color]}`}>
                  {m.badge}
                </span>
                <p className="text-[12px] font-medium text-white/80">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Prompt input */}
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-white/32 mb-3">Prompt</p>
          <div className="rounded-[20px] border border-white/8 bg-white/[0.03] overflow-hidden focus-within:border-white/16 transition-colors">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
              placeholder="Beschrijf de afbeelding die je wil genereren..."
              rows={4}
              className="w-full bg-transparent px-5 py-4 text-sm text-white/85 placeholder:text-white/24 outline-none resize-none"
            />
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/6">
              <span className="text-[11px] text-white/24">{prompt.length}/1000 · ⌘↵ om te genereren</span>
              <button
                type="button"
                onClick={generate}
                disabled={!prompt.trim() || loading}
                className="rounded-[12px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-5 py-2 text-[13px] font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.24)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Genereren..." : "Genereer →"}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[16px] border border-red-400/20 bg-red-400/8 px-4 py-3 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-[20px] border border-white/8 bg-white/[0.02] aspect-square max-w-lg mx-auto flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
            <p className="text-sm text-white/40">Genereren met {activeModel.label}...</p>
          </div>
        )}

        {/* Image result */}
        {imageUrl && !loading && (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/32">Resultaat</p>
            <div className="rounded-[20px] overflow-hidden border border-white/8">
              <img src={imageUrl} alt={prompt} className="w-full object-cover" />
            </div>
            <div className="flex gap-2">
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                Download
              </a>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                Nieuwe afbeelding
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}