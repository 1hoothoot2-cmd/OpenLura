"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Notebook {
  id: string;
  name: string;
  emoji: string;
  description: string;
  document_count: number;
}

interface BrainDocument {
  id: string;
  name: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

// ─── Lang ─────────────────────────────────────────────────────────────────────

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
  back:          { en: "Brain", nl: "Brain", de: "Brain", fr: "Brain", es: "Brain", pt: "Brain", hi: "Brain" },
  documents:     { en: "Documents", nl: "Documenten", de: "Dokumente", fr: "Documents", es: "Documentos", pt: "Documentos", hi: "दस्तावेज़" },
  upload:        { en: "Upload document", nl: "Document uploaden", de: "Dokument hochladen", fr: "Téléverser un document", es: "Subir documento", pt: "Enviar documento", hi: "दस्तावेज़ अपलोड करें" },
  uploading:     { en: "Uploading…", nl: "Uploaden…", de: "Hochladen…", fr: "Téléversement…", es: "Subiendo…", pt: "Enviando…", hi: "अपलोड हो रहा है…" },
  empty_docs:    { en: "No documents yet. Upload your first file.", nl: "Nog geen documenten. Upload je eerste bestand.", de: "Noch keine Dokumente.", fr: "Aucun document. Téléversez le premier.", es: "Sin documentos. Sube el primero.", pt: "Sem documentos. Envie o primeiro.", hi: "कोई दस्तावेज़ नहीं।" },
  drop_hint:     { en: "Drop a file or click to browse", nl: "Sleep een bestand of klik om te bladeren", de: "Datei ablegen oder klicken", fr: "Déposez un fichier ou cliquez", es: "Suelta un archivo o haz clic", pt: "Solte um arquivo ou clique", hi: "फ़ाइल छोड़ें या क्लिक करें" },
  supported:     { en: "PDF, TXT, MD — max 10 MB", nl: "PDF, TXT, MD — max 10 MB", de: "PDF, TXT, MD — max 10 MB", fr: "PDF, TXT, MD — max 10 Mo", es: "PDF, TXT, MD — máx 10 MB", pt: "PDF, TXT, MD — máx 10 MB", hi: "PDF, TXT, MD — अधिकतम 10 MB" },
  delete_confirm:{ en: "Delete this document?", nl: "Dit document verwijderen?", de: "Dokument löschen?", fr: "Supprimer ce document?", es: "¿Eliminar este documento?", pt: "Excluir este documento?", hi: "यह दस्तावेज़ हटाएं?" },
  loading:       { en: "Loading…", nl: "Laden…", de: "Laden…", fr: "Chargement…", es: "Cargando…", pt: "Carregando…", hi: "लोड हो रहा है…" },
  not_found:     { en: "Notebook not found.", nl: "Notitieblok niet gevonden.", de: "Notizbuch nicht gefunden.", fr: "Cahier introuvable.", es: "Cuaderno no encontrado.", pt: "Caderno não encontrado.", hi: "नोटबुक नहीं मिली।" },
  error_type:    { en: "Only PDF, TXT and MD files are supported.", nl: "Alleen PDF, TXT en MD bestanden worden ondersteund.", de: "Nur PDF, TXT und MD werden unterstützt.", fr: "Seuls PDF, TXT et MD sont pris en charge.", es: "Solo se admiten PDF, TXT y MD.", pt: "Apenas PDF, TXT e MD são suportados.", hi: "केवल PDF, TXT और MD समर्थित हैं।" },
  error_size:    { en: "File is too large. Max 10 MB.", nl: "Bestand is te groot. Max 10 MB.", de: "Datei zu groß. Max 10 MB.", fr: "Fichier trop volumineux. Max 10 Mo.", es: "Archivo demasiado grande. Máx 10 MB.", pt: "Arquivo muito grande. Máx 10 MB.", hi: "फ़ाइल बहुत बड़ी है। अधिकतम 10 MB।" },
  error_upload:  { en: "Upload failed. Try again.", nl: "Upload mislukt. Probeer opnieuw.", de: "Upload fehlgeschlagen.", fr: "Échec du téléversement.", es: "Error al subir.", pt: "Falha no envio.", hi: "अपलोड विफल। पुनः प्रयास करें।" },
} as const;

function tr(key: keyof typeof T, lang: string): string {
  const l = lang as Lang;
  return (T[key] as Record<Lang, string>)[l] ?? (T[key] as Record<Lang, string>)["en"];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/markdown"];
const ALLOWED_EXTS = [".pdf", ".txt", ".md"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): string {
  if (type === "application/pdf") return "📄";
  if (type === "text/markdown") return "📝";
  return "📃";
}

function isAllowedFile(file: File): "ok" | "type" | "size" {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) return "type";
  if (file.size > MAX_SIZE) return "size";
  return "ok";
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function NotebookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const notebookId = params?.id as string;
  const lang = useLang();

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [notebookLoading, setNotebookLoading] = useState(true);

  const [docs, setDocs] = useState<BrainDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Auth ────────────────────────────────────────────────────────────────
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

  // ── Load notebook ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !notebookId) return;
    fetch(`/api/brain/notebooks?id=${encodeURIComponent(notebookId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async r => {
        if (!r.ok) { setNotebook(null); return; }
        const d = await r.json();
        setNotebook(d.notebook ?? null);
      })
      .catch(() => setNotebook(null))
      .finally(() => setNotebookLoading(false));
  }, [authed, notebookId]);

  // ── Load documents ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed || !notebookId) return;
    loadDocs();
  }, [authed, notebookId]);

  async function loadDocs() {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/brain/documents?notebookId=${encodeURIComponent(notebookId)}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDocs(d.documents ?? []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  async function handleUpload(file: File) {
    setUploadError("");
    const check = isAllowedFile(file);
    if (check === "type") { setUploadError(tr("error_type", lang)); return; }
    if (check === "size") { setUploadError(tr("error_size", lang)); return; }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("notebookId", notebookId);

      const res = await fetch("/api/brain/documents", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });

      if (!res.ok) throw new Error();
      const d = await res.json();
      setDocs(prev => [d.document, ...prev]);
      // Update local notebook doc count
      setNotebook(prev => prev ? { ...prev, document_count: prev.document_count + 1 } : prev);
    } catch {
      setUploadError(tr("error_upload", lang));
    } finally {
      setUploading(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(docId: string) {
    if (!confirm(tr("delete_confirm", lang))) return;
    setDeletingId(docId);
    try {
      await fetch(`/api/brain/documents?id=${encodeURIComponent(docId)}&notebookId=${encodeURIComponent(notebookId)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      setDocs(prev => prev.filter(d => d.id !== docId));
      setNotebook(prev => prev ? { ...prev, document_count: Math.max(0, prev.document_count - 1) } : prev);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [notebookId, lang]);

  // ── Guards ───────────────────────────────────────────────────────────────
  if (!authChecked) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white/40 text-sm">{tr("loading", lang)}</div>;
  }
  if (!authed) return null;

  if (notebookLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white/40 text-sm">{tr("loading", lang)}</div>;
  }

  if (!notebook) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#050510] text-white/40 text-sm gap-4">
        <p>{tr("not_found", lang)}</p>
        <a href="/brain" className="text-[#93c5fd] hover:text-white transition-colors text-xs">← {tr("back", lang)}</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050510] text-white">

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#050510]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-5 h-14">
          <a href="/brain" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M10 13L5 8l5-5" />
            </svg>
            {tr("back", lang)}
          </a>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            {uploading ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                {tr("uploading", lang)}
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M8 11V3M5 6l3-3 3 3" /><path d="M3 13h10" />
                </svg>
                {tr("upload", lang)}
              </>
            )}
          </button>
        </div>
      </header>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />

      {/* ── Hero ── */}
      <div className="mx-auto max-w-4xl px-5 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-11 w-11 flex items-center justify-center rounded-[14px] bg-white/[0.06] text-2xl">
            {notebook.emoji}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{notebook.name}</h1>
            {notebook.description && (
              <p className="text-sm text-white/36 mt-0.5">{notebook.description}</p>
            )}
          </div>
        </div>
        <p className="text-xs text-white/24 mt-3 ml-[56px]">{notebook.document_count} {tr("documents", lang).toLowerCase()}</p>
      </div>

      {/* ── Main ── */}
      <main className="mx-auto max-w-4xl px-5 pb-24 space-y-6">

        {/* Upload error */}
        {uploadError && (
          <div className="rounded-[14px] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
            {uploadError}
            <button type="button" onClick={() => setUploadError("")} className="text-red-400/60 hover:text-red-300 ml-3">✕</button>
          </div>
        )}

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`rounded-[20px] border-2 border-dashed px-8 py-10 text-center cursor-pointer transition-all ${
            dragging
              ? "border-[#3b82f6]/60 bg-[#3b82f6]/[0.06]"
              : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <span className="h-8 w-8 rounded-full border-2 border-white/20 border-t-[#3b82f6] animate-spin" />
              <p className="text-sm text-white/40">{tr("uploading", lang)}</p>
            </div>
          ) : (
            <>
              <div className="text-3xl mb-3 opacity-30">📎</div>
              <p className="text-sm text-white/50">{tr("drop_hint", lang)}</p>
              <p className="text-xs text-white/24 mt-1">{tr("supported", lang)}</p>
            </>
          )}
        </div>

        {/* Documents list */}
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/28 mb-3">{tr("documents", lang)}</p>

          {docsLoading ? (
            <p className="text-sm text-white/24 py-8 text-center">{tr("loading", lang)}</p>
          ) : docs.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-white/8 px-6 py-12 text-center">
              <div className="text-3xl mb-3 opacity-20">📂</div>
              <p className="text-sm text-white/28">{tr("empty_docs", lang)}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  deleting={deletingId === doc.id}
                  onDelete={() => handleDelete(doc.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Doc Row ──────────────────────────────────────────────────────────────────

function DocRow({
  doc,
  deleting,
  onDelete,
}: {
  doc: BrainDocument;
  deleting: boolean;
  onDelete: () => void;
}) {
  const date = new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className={`group flex items-center gap-4 rounded-[16px] border border-white/8 bg-white/[0.025] px-4 py-3 transition-all hover:border-white/12 hover:bg-white/[0.04] ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="text-xl shrink-0">{fileIcon(doc.file_type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/88 truncate">{doc.name}</p>
        <p className="text-[11px] text-white/28 mt-0.5">{formatBytes(doc.file_size)} · {date}</p>
      </div>
      <div className="shrink-0 px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-white/30 uppercase tracking-wide">
        {doc.file_type === "application/pdf" ? "PDF" : doc.file_type === "text/markdown" ? "MD" : "TXT"}
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all"
      >
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 2l10 10M12 2L2 12" />
        </svg>
      </button>
    </div>
  );
}