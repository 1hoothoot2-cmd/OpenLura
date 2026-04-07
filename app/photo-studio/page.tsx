"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const MODELS = [
  { id: "dalle3", label: "DALL-E 3", badge: "OpenAI", color: "emerald", points: 2 },
  { id: "nano-banana", label: "Nano Banana", badge: "Snel", color: "blue", points: 2 },
  { id: "nano-banana-2", label: "Nano Banana 2", badge: "Scherp", color: "purple", points: 5 },
  { id: "nano-banana-pro", label: "Nano Banana Pro", badge: "Max", color: "amber", points: 10 },
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

const CREDIT_PACKAGES = [
  { credits: 25, price: "€2", label: "25 credits" },
  { credits: 75, price: "€5", label: "75 credits" },
  { credits: 150, price: "€9", label: "150 credits" },
  { credits: 500, price: "€30", label: "500 credits" },
];

interface HistoryItem {
  id: string;
  url: string;
  prompt: string;
  model: string;
  points: number;
  created_at: string;
}

function PhotoStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ModelId>("nano-banana-2");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [buyingCredits, setBuyingCredits] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [lightbox, setLightbox] = useState<HistoryItem | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth", { method: "GET", credentials: "same-origin" })
      .then(r => r.json())
      .then(d => {
        if (!d?.authenticated) { router.replace("/personal-workspace"); return; }
        setAuthChecked(true);
        loadStats();
      })
      .catch(() => router.replace("/personal-workspace"));
  }, []);

  useEffect(() => {
    if (searchParams.get("credits") === "success") {
      setSuccessMsg("Credits toegevoegd! Je saldo is bijgewerkt.");
      loadStats();
    }
  }, [searchParams]);

  async function deleteFromHistory(id: string) {
    setHistory(prev => prev.filter(item => item.id !== id));
    // Sync naar server
    try {
      await fetch("/api/image-generate", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {}
  }

  function handleEditUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setEditImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    // Voor fal.ai hebben we een publieke URL nodig — gebruik de history URL of laat user een URL invoeren
    setEditImageUrl(null); // wordt via URL input gezet
  }

  async function loadStats() {
    try {
      const res = await fetch("/api/image-generate", { method: "GET", credentials: "same-origin" });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points ?? 0);
        setHistory(data.history ?? []);
      }
    } catch {}
  }

  function handleReset() {
    setImageUrl(null);
    setPrompt("");
    setError(null);
    setEditImageUrl(null);
    setEditImagePreview(null);
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
        body: JSON.stringify({ prompt: prompt.trim(), model, ...(editImageUrl ? { editImageUrl } : {}) }),
      });
      const data = await res.json();
      if (data?.code === "upgrade_required") {
        router.push("/personal-dashboard");
        return;
      }
      if (data?.code === "no_points") {
        setError("Geen credits meer. Koop extra credits om door te gaan.");
        setShowCreditsModal(true);
        setPoints(data.points ?? 0);
        return;
      }
      if (!res.ok) { setError(data?.error || "Generatie mislukt"); return; }
      setImageUrl(data.url);
      setPoints(data.points);
      setHistory(prev => [{
        id: crypto.randomUUID(),
        url: data.url,
        prompt: prompt.trim(),
        model,
        points: MODELS.find(m => m.id === model)?.points ?? 0,
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 50));
    } catch {
      setError("Verbindingsfout, probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  async function buyCredits(credits: number) {
    setBuyingCredits(true);
    try {
      const res = await fetch("/api/stripe/credits", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {} finally {
      setBuyingCredits(false);
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
  const canGenerate = points === null || points >= activeModel.points;

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

        {/* Credits display */}
        <div className="flex items-center gap-3">
          {points !== null && (
            <button
              type="button"
              onClick={() => setShowCreditsModal(true)}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 hover:bg-white/[0.08] transition-all"
            >
              <span className="text-[11px] text-white/50">Credits</span>
              <span className={`text-[13px] font-semibold ${points < 10 ? "text-red-400" : points < 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {points}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowHistory(v => !v)}
            className="h-8 w-8 flex items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
            title="Geschiedenis"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
          </button>
        </div>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="bg-emerald-400/10 border-b border-emerald-400/20 px-6 py-3 flex items-center justify-between">
          <p className="text-sm text-emerald-300">✅ {successMsg}</p>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-white/40 hover:text-white text-lg">×</button>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className={`grid gap-8 ${showHistory ? "lg:grid-cols-[1fr_320px]" : ""}`}>

          {/* LEFT: Generator */}
          <div className="space-y-6">

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
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${BADGE_COLORS[m.color]}`}>
                        {m.badge}
                      </span>
                      <span className="text-[10px] text-white/30">{m.points}pt</span>
                    </div>
                    <p className="text-[12px] font-medium text-white/80">{m.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Edit mode */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/32">Bewerken (optioneel)</p>
                {editImageUrl && (
                  <button type="button" onClick={() => { setEditImageUrl(null); setEditImagePreview(null); }}
                    className="text-[11px] text-white/36 hover:text-white/70 transition-colors">
                    Verwijderen ×
                  </button>
                )}
              </div>
              {editImageUrl ? (
                <div className="rounded-[16px] border border-blue-400/20 bg-blue-400/[0.04] p-3 flex items-center gap-3">
                  <img src={editImageUrl} alt="Edit bron" className="h-16 w-16 rounded-[10px] object-cover border border-white/10" />
                  <div>
                    <p className="text-[12px] text-white/70">Foto wordt bewerkt</p>
                    <p className="text-[11px] text-white/36 mt-0.5">Beschrijf de aanpassing in de prompt</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.02] px-4 py-3">
                  <p className="text-[12px] text-white/36 mb-2">Plak een afbeelding URL om te bewerken:</p>
                  <input
                    type="url"
                    placeholder="https://... (publieke afbeelding URL)"
                    onChange={e => setEditImageUrl(e.target.value.trim() || null)}
                    className="w-full bg-transparent text-sm text-white/70 outline-none placeholder:text-white/20 border-b border-white/8 pb-1 focus:border-white/20 transition-colors"
                  />
                  <p className="text-[10px] text-white/24 mt-2">Of klik op een foto in je geschiedenis → "Bewerken"</p>
                </div>
              )}
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
                  <span className="text-[11px] text-white/24">{prompt.length}/1000 · kost {activeModel.points}pt</span>
                  <button
                    type="button"
                    onClick={canGenerate ? generate : () => setShowCreditsModal(true)}
                    disabled={!prompt.trim() || loading}
                    className={`rounded-[12px] px-5 py-2 text-[13px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                      canGenerate
                        ? "bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] shadow-[0_6px_16px_rgba(59,130,246,0.24)] hover:brightness-110"
                        : "bg-red-500/80 hover:bg-red-500"
                    }`}
                  >
                    {loading ? "Genereren..." : canGenerate ? "Genereer →" : "Credits op →"}
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

            {/* Loading */}
            {loading && (
              <div className="rounded-[20px] border border-white/8 bg-white/[0.02] aspect-square max-w-lg mx-auto flex flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-white/10 border-t-blue-400 animate-spin" />
                <p className="text-sm text-white/40">Genereren met {activeModel.label}... ({activeModel.points}pt)</p>
              </div>
            )}

            {/* Result */}
            {imageUrl && !loading && (
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/32">Resultaat</p>
                <div className="rounded-[20px] overflow-hidden border border-white/8">
                  <img src={imageUrl} alt={prompt} className="w-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all">
                    Download
                  </a>
                  <button type="button" onClick={handleReset}
                    className="rounded-[12px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.08] transition-all">
                    Nieuwe afbeelding
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: History */}
          {showHistory && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-white/32">Geschiedenis</p>
                <span className="text-[11px] text-white/24">{history.length} foto's</span>
              </div>
              {history.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-white/8 px-4 py-8 text-center">
                  <p className="text-2xl mb-2 opacity-20">🎨</p>
                  <p className="text-sm text-white/28">Nog geen afbeeldingen gegenereerd.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {history.map(item => (
                    <div key={item.id} className="group relative rounded-[14px] overflow-hidden border border-white/8 aspect-square cursor-pointer"
                      onClick={() => setLightbox(item)}>
                      <img src={item.url} alt={item.prompt} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                        <p className="text-[10px] text-white/90 line-clamp-2 leading-3.5">{item.prompt}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-white/40">{item.points}pt</span>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); deleteFromHistory(item.id); }}
                            className="h-5 w-5 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
                          >
                            <svg viewBox="0 0 14 14" className="h-2.5 w-2.5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setLightbox(null)}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <div className="relative z-10 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="rounded-[24px] overflow-hidden border border-white/10 shadow-[0_32px_80px_rgba(0,0,0,0.80)]">
              <img src={lightbox.url} alt={lightbox.prompt} className="w-full object-cover" />
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-white/80 leading-5">{lightbox.prompt}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-white/36">{lightbox.model}</span>
                  <span className="text-[11px] text-white/36">·</span>
                  <span className="text-[11px] text-white/36">{lightbox.points}pt</span>
                  <span className="text-[11px] text-white/36">·</span>
                  <span className="text-[11px] text-white/36">{new Date(lightbox.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={lightbox.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-[12px] border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] text-white/70 hover:text-white hover:bg-white/[0.10] transition-all"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => { setEditImageUrl(lightbox.url); setLightbox(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  className="rounded-[12px] border border-blue-400/20 bg-blue-400/[0.06] px-4 py-2 text-[13px] text-blue-300/70 hover:text-blue-200 hover:bg-blue-400/[0.12] transition-all"
                >
                  Bewerken
                </button>
                <button
                  type="button"
                  onClick={() => { deleteFromHistory(lightbox.id); setLightbox(null); }}
                  className="rounded-[12px] border border-red-400/20 bg-red-400/[0.06] px-4 py-2 text-[13px] text-red-400/70 hover:text-red-300 hover:bg-red-400/[0.12] transition-all"
                >
                  Verwijderen
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox(null)}
                  className="rounded-[12px] border border-white/10 bg-white/[0.04] px-3 py-2 text-white/40 hover:text-white transition-all"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credits modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowCreditsModal(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0b0b17] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.60)]">
            <button type="button" onClick={() => setShowCreditsModal(false)}
              className="absolute right-4 top-4 h-7 w-7 flex items-center justify-center rounded-full border border-white/8 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all">
              ×
            </button>
            <div className="mb-1 text-2xl">⚡</div>
            <h2 className="text-lg font-semibold text-white/92">Photo Credits</h2>
            <p className="mt-1 text-sm text-white/40 mb-2">Huidig saldo: <span className={`font-semibold ${(points ?? 0) < 10 ? "text-red-400" : "text-emerald-400"}`}>{points ?? 0} credits</span></p>
            <p className="text-xs text-white/30 mb-5">Go plan: 100 credits/maand gratis. Extra credits koop je hieronder.</p>
            <div className="space-y-2 mb-4">
              {CREDIT_PACKAGES.map(pkg => (
                <button
                  key={pkg.credits}
                  type="button"
                  onClick={() => buyCredits(pkg.credits)}
                  disabled={buyingCredits}
                  className="w-full flex items-center justify-between rounded-[14px] border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-blue-400/30 hover:bg-blue-400/[0.06] transition-all disabled:opacity-50"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-white/85">{pkg.label}</p>
                    <p className="text-[11px] text-white/36">+{pkg.credits} credits</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-300">{pkg.price}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-white/20 text-center">Credits verlopen niet. Go plan reset maandelijks naar 100.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhotoStudioPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white">
        <p className="text-white/40 text-sm">Laden...</p>
      </div>
    }>
      <PhotoStudioContent />
    </Suspense>
  );
}