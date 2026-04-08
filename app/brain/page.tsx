"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notebook {
  id: string;
  name: string;
  emoji: string;
  description: string;
  created_at: string;
  document_count: number;
}

// ─── Lang (reuse Phase 4.8 pattern) ──────────────────────────────────────────

function useLang(): string {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    const b = navigator.language?.split("-")[0] ?? "en";
    const supported = ["en", "nl", "de", "fr", "es", "pt", "hi"];
    setLang(supported.includes(b) ? b : "en");
  }, []);
  return lang;
}

type Lang = "en" | "nl" | "de" | "fr" | "es" | "pt" | "hi";

const T = {
  brain:         { en: "Your AI Brain", nl: "Jouw AI Brein", de: "Dein KI-Gehirn", fr: "Votre cerveau IA", es: "Tu cerebro IA", pt: "Seu cérebro IA", hi: "आपका AI दिमाग" },
  sub:           { en: "Organize your knowledge. Train your AI.", nl: "Organiseer kennis. Train je AI.", de: "Wissen organisieren. KI trainieren.", fr: "Organisez votre savoir. Entraînez votre IA.", es: "Organiza tu conocimiento. Entrena tu IA.", pt: "Organize seu conhecimento. Treine sua IA.", hi: "अपना ज्ञान व्यवस्थित करें। AI को प्रशिक्षित करें।" },
  notebooks:     { en: "Notebooks", nl: "Notitieblokken", de: "Notizbücher", fr: "Cahiers", es: "Cuadernos", pt: "Cadernos", hi: "नोटबुक" },
  new_notebook:  { en: "New notebook", nl: "Nieuw notitieblok", de: "Neues Notizbuch", fr: "Nouveau cahier", es: "Nuevo cuaderno", pt: "Novo caderno", hi: "नई नोटबुक" },
  empty:         { en: "No notebooks yet. Create your first one.", nl: "Nog geen notitieblokken. Maak je eerste aan.", de: "Noch keine Notizbücher. Erstelle dein erstes.", fr: "Aucun cahier. Créez le premier.", es: "Sin cuadernos. Crea el primero.", pt: "Sem cadernos. Crie o primeiro.", hi: "कोई नोटबुक नहीं। पहला बनाएं।" },
  create:        { en: "Create", nl: "Aanmaken", de: "Erstellen", fr: "Créer", es: "Crear", pt: "Criar", hi: "बनाएं" },
  cancel:        { en: "Cancel", nl: "Annuleren", de: "Abbrechen", fr: "Annuler", es: "Cancelar", pt: "Cancelar", hi: "रद्द करें" },
  name_ph:       { en: "Notebook name…", nl: "Naam notitieblok…", de: "Notizbuchname…", fr: "Nom du cahier…", es: "Nombre del cuaderno…", pt: "Nome do caderno…", hi: "नोटबुक का नाम…" },
  desc_ph:       { en: "What is this about? (optional)", nl: "Waar gaat dit over? (optioneel)", de: "Worum geht es? (optional)", fr: "De quoi s'agit-il? (optionnel)", es: "¿De qué trata? (opcional)", pt: "Sobre o que é? (opcional)", hi: "यह किस बारे में है? (वैकल्पिक)" },
  docs:          { en: "docs", nl: "docs", de: "Docs", fr: "docs", es: "docs", pt: "docs", hi: "दस्तावेज़" },
  category_label: { en: "Category", nl: "Categorie", de: "Kategorie", fr: "Catégorie", es: "Categoría", pt: "Categoria", hi: "श्रेणी" },
  delete_confirm:{ en: "Delete this notebook?", nl: "Dit notitieblok verwijderen?", de: "Notizbuch löschen?", fr: "Supprimer ce cahier?", es: "¿Eliminar este cuaderno?", pt: "Excluir este caderno?", hi: "यह नोटबुक हटाएं?" },
  open:          { en: "Open", nl: "Openen", de: "Öffnen", fr: "Ouvrir", es: "Abrir", pt: "Abrir", hi: "खोलें" },
  saving:        { en: "Creating…", nl: "Aanmaken…", de: "Erstelle…", fr: "Création…", es: "Creando…", pt: "Criando…", hi: "बना रहे हैं…" },
  back:          { en: "Dashboard", nl: "Dashboard", de: "Dashboard", fr: "Tableau de bord", es: "Panel", pt: "Painel", hi: "डैशबोर्ड" },
  loading:       { en: "Loading…", nl: "Laden…", de: "Laden…", fr: "Chargement…", es: "Cargando…", pt: "Carregando…", hi: "लोड हो रहा है…" },
  error_auth:    { en: "You need to be logged in to use Brain.", nl: "Je moet ingelogd zijn voor Brain.", de: "Du musst eingeloggt sein.", fr: "Vous devez être connecté.", es: "Debes iniciar sesión.", pt: "Você precisa estar logado.", hi: "Brain के लिए लॉगिन करें।" },
} as const;

function tr(key: keyof typeof T, lang: string): string {
  const l = lang as Lang;
  return (T[key] as Record<Lang, string>)[l] ?? (T[key] as Record<Lang, string>)["en"];
}

// ─── Emoji picker (simple preset) ────────────────────────────────────────────

const EMOJIS = ["🧠", "📚", "💡", "🔬", "🎯", "💼", "🌍", "🎨", "⚙️", "🚀", "📖", "🧪", "🗂️", "✍️", "🌱"];

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrainPage() {
  const router = useRouter();
  const lang = useLang();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loadingNbs, setLoadingNbs] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEmoji, setNewEmoji] = useState("🧠");
  const [newCategory, setNewCategory] = useState("work");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  // ── Auth check ────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth", { method: "GET", credentials: "same-origin", cache: "no-store" })
      .then(async r => {
        const d = await r.json().catch(() => null);
        const ok = !!d?.authenticated;
        setAuthed(ok);
        setAuthChecked(true);
        if (!ok) router.replace("/personal-dashboard");
      })
      .catch(() => { setAuthed(false); setAuthChecked(true); router.replace("/personal-dashboard"); });
  }, [router]);

  // ── Load notebooks ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return;
    loadNotebooks();
  }, [authed]);

  async function loadNotebooks() {
    setLoadingNbs(true);
    try {
      const res = await fetch("/api/brain/notebooks", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setNotebooks(data.notebooks ?? []);
    } catch {
      setNotebooks([]);
    } finally {
      setLoadingNbs(false);
    }
  }

  // ── Create notebook ───────────────────────────────────────────────────────
  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/brain/notebooks", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newDesc.trim(), emoji: newEmoji, category: newCategory }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();
      setNotebooks(prev => [data.notebook, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewDesc("");
      setNewEmoji("🧠");
      setNewCategory("work");
    } catch {
      setCreateError("Something went wrong. Try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Delete notebook ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm(tr("delete_confirm", lang))) return;
    setDeletingId(id);
    try {
      await fetch(`/api/brain/notebooks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      setNotebooks(prev => prev.filter(n => n.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  // ── Focus on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (showCreate) setTimeout(() => nameRef.current?.focus(), 60);
  }, [showCreate]);

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white/40 text-sm">
        {tr("loading", lang)}
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-[#050510] text-white">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#050510]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-5 h-14">
          <a
            href="/personal-dashboard"
            className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 13L5 8l5-5" />
            </svg>
            {tr("back", lang)}
          </a>

          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 transition-all active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M8 3v10M3 8h10" />
            </svg>
            {tr("new_notebook", lang)}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="mx-auto max-w-5xl px-5 pt-12 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🧠</span>
          <h1 className="text-2xl font-semibold tracking-tight">{tr("brain", lang)}</h1>
        </div>
        <p className="text-sm text-white/38 ml-[52px]">{tr("sub", lang)}</p>
      </div>

      {/* ── Notebooks grid ── */}
      <main className="mx-auto max-w-5xl px-5 pb-24">
        <p className="text-xs uppercase tracking-[0.14em] text-white/28 mb-4">{tr("notebooks", lang)}</p>

        {loadingNbs ? (
          <div className="text-sm text-white/28 py-16 text-center">{tr("loading", lang)}</div>
        ) : notebooks.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-white/10 px-6 py-20 text-center">
            <div className="text-4xl mb-4 opacity-20">🧠</div>
            <p className="text-sm text-white/30">{tr("empty", lang)}</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-5 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-5 py-2 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.24)] hover:brightness-110 transition-all"
            >
              {tr("new_notebook", lang)}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map(nb => (
              <NotebookCard
                key={nb.id}
                notebook={nb}
                lang={lang}
                deleting={deletingId === nb.id}
                onDelete={() => handleDelete(nb.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Create modal ── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div className="w-full max-w-[420px] rounded-[28px] border border-white/10 bg-[#0a0f1e]/98 shadow-[0_24px_64px_rgba(0,0,0,0.50)] backdrop-blur-2xl overflow-hidden">

            {/* Emoji picker */}
            <div className="px-6 pt-6 pb-4 border-b border-white/6">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30 mb-3">Choose icon</p>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewEmoji(e)}
                    className={`h-9 w-9 flex items-center justify-center rounded-xl text-lg transition-all ${newEmoji === e ? "bg-[#3b82f6]/24 ring-1 ring-[#3b82f6]/60" : "bg-white/[0.04] hover:bg-white/[0.08]"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-6 py-5 space-y-3">
              <input
                ref={nameRef}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowCreate(false); }}
                placeholder={tr("name_ph", lang)}
                maxLength={60}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/24 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
              />
              <div>
                <p className="text-[11px] uppercase tracking-[0.14em] text-white/28 mb-2">{tr("category_label", lang)}</p>
                <div className="flex gap-2">
                  {[
                    { value: "work", label: "💼 Work" },
                    { value: "school", label: "🎓 School" },
                    { value: "personal", label: "🌱 Personal" },
                    { value: "other", label: "📂 Other" },
                  ].map(cat => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setNewCategory(cat.value)}
                      className={`flex-1 rounded-[12px] border py-2 text-xs font-medium transition-all ${
                        newCategory === cat.value
                          ? "border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#93c5fd]"
                          : "border-white/8 bg-white/[0.03] text-white/40 hover:border-white/14 hover:text-white/70"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder={tr("desc_ph", lang)}
                maxLength={200}
                rows={2}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/24 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all resize-none"
              />

              {createError && (
                <p className="text-xs text-red-400">{createError}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="flex-1 rounded-[14px] bg-white/[0.04] py-2.5 text-sm text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
                >
                  {tr("cancel", lang)}
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex-1 rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {creating ? tr("saving", lang) : tr("create", lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Notebook Card ────────────────────────────────────────────────────────────

function NotebookCard({
  notebook,
  lang,
  deleting,
  onDelete,
}: {
  notebook: Notebook;
  lang: string;
  deleting: boolean;
  onDelete: () => void;
}) {
  const tr2 = (key: keyof typeof T) => tr(key, lang);
  const createdAt = new Date(notebook.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className={`group relative rounded-[20px] border border-white/8 bg-white/[0.025] p-5 transition-all duration-150 hover:border-white/14 hover:bg-white/[0.04] ${deleting ? "opacity-40 pointer-events-none" : ""}`}>

      {/* Emoji + name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-[12px] bg-white/[0.06] text-xl">
            {notebook.emoji}
          </div>
          <div>
            <p className="text-sm font-medium text-white/90 leading-tight">{notebook.name}</p>
            <p className="text-[11px] text-white/28 mt-0.5">{createdAt} · {notebook.document_count} {tr2("docs")}</p>
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
          title="Delete"
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>

      {/* Description */}
      {notebook.description && (
        <p className="text-xs text-white/36 leading-relaxed mb-4 line-clamp-2">{notebook.description}</p>
      )}

      {/* Open button */}
      <a
        href={`/brain/${notebook.id}`}
        className="flex items-center justify-center gap-1.5 w-full rounded-[12px] border border-white/8 py-2 text-xs text-white/50 hover:border-[#3b82f6]/30 hover:text-[#93c5fd] hover:bg-[#3b82f6]/[0.06] transition-all"
      >
        {tr2("open")}
        <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 7h8M8 4l3 3-3 3" />
        </svg>
      </a>
    </div>
  );
}