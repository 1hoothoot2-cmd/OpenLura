"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

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
  source_url?: string;
  created_at: string;
}

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
  back:               { en: "Brain", nl: "Brain", de: "Brain", fr: "Brain", es: "Brain", pt: "Brain", hi: "Brain" },
  documents:          { en: "Sources", nl: "Bronnen", de: "Quellen", fr: "Sources", es: "Fuentes", pt: "Fontes", hi: "स्रोत" },
  upload:             { en: "Upload file", nl: "Bestand uploaden", de: "Datei hochladen", fr: "Téléverser", es: "Subir archivo", pt: "Enviar arquivo", hi: "फ़ाइल अपलोड करें" },
  uploading:          { en: "Uploading…", nl: "Uploaden…", de: "Hochladen…", fr: "Téléversement…", es: "Subiendo…", pt: "Enviando…", hi: "अपलोड हो रहा है…" },
  add_source:         { en: "Add URL", nl: "URL toevoegen", de: "URL hinzufügen", fr: "Ajouter URL", es: "Añadir URL", pt: "Adicionar URL", hi: "URL जोड़ें" },
  adding_source:      { en: "Fetching…", nl: "Ophalen…", de: "Abrufen…", fr: "Récupération…", es: "Obteniendo…", pt: "Buscando…", hi: "प्राप्त हो रहा है…" },
  source_modal_title: { en: "Add external source", nl: "Externe bron toevoegen", de: "Externe Quelle hinzufügen", fr: "Ajouter une source externe", es: "Añadir fuente externa", pt: "Adicionar fonte externa", hi: "बाहरी स्रोत जोड़ें" },
  source_ph:          { en: "https://… or YouTube URL", nl: "https://… of YouTube URL", de: "https://… oder YouTube-URL", fr: "https://… ou URL YouTube", es: "https://… o URL de YouTube", pt: "https://… ou URL do YouTube", hi: "https://… या YouTube URL" },
  source_hint:        { en: "Paste a webpage or YouTube video URL", nl: "Plak een webpagina of YouTube video URL", de: "Webseite oder YouTube-URL einfügen", fr: "Collez une URL de page web ou YouTube", es: "Pega la URL de una página web o YouTube", pt: "Cole a URL de uma página web ou YouTube", hi: "वेबपेज या YouTube URL पेस्ट करें" },
  add_btn:            { en: "Add source", nl: "Bron toevoegen", de: "Quelle hinzufügen", fr: "Ajouter", es: "Agregar", pt: "Adicionar", hi: "स्रोत जोड़ें" },
  add_note:           { en: "Add note", nl: "Notitie toevoegen", de: "Notiz hinzufügen", fr: "Ajouter une note", es: "Añadir nota", pt: "Adicionar nota", hi: "नोट जोड़ें" },
  note_modal_title:   { en: "New note", nl: "Nieuwe notitie", de: "Neue Notiz", fr: "Nouvelle note", es: "Nueva nota", pt: "Nova nota", hi: "नई नोट" },
  note_title_ph:      { en: "Title (optional)", nl: "Titel (optioneel)", de: "Titel (optional)", fr: "Titre (optionnel)", es: "Título (opcional)", pt: "Título (opcional)", hi: "शीर्षक (वैकल्पिक)" },
  note_body_ph:       { en: "Write your note…", nl: "Schrijf je notitie…", de: "Notiz schreiben…", fr: "Écrivez votre note…", es: "Escribe tu nota…", pt: "Escreva sua nota…", hi: "अपनी नोट लिखें…" },
  note_save:          { en: "Save note", nl: "Notitie opslaan", de: "Notiz speichern", fr: "Enregistrer", es: "Guardar nota", pt: "Salvar nota", hi: "नोट सहेजें" },
  note_saving:        { en: "Saving…", nl: "Opslaan…", de: "Speichern…", fr: "Enregistrement…", es: "Guardando…", pt: "Salvando…", hi: "सहेज रहे हैं…" },
  error_note:         { en: "Note body is required.", nl: "Notitietekst is verplicht.", de: "Notizinhalt erforderlich.", fr: "Le contenu est requis.", es: "El contenido es obligatorio.", pt: "Conteúdo obrigatório.", hi: "नोट सामग्री आवश्यक है।" },
  error_note_save:    { en: "Failed to save note.", nl: "Notitie opslaan mislukt.", de: "Notiz konnte nicht gespeichert werden.", fr: "Échec de l'enregistrement.", es: "Error al guardar.", pt: "Falha ao salvar.", hi: "नोट सहेजने में विफल।" },
  empty_docs:         { en: "No sources yet. Upload a file, add a URL, or write a note.", nl: "Nog geen bronnen. Upload een bestand of voeg een URL toe.", de: "Noch keine Quellen.", fr: "Aucune source.", es: "Sin fuentes.", pt: "Sem fontes.", hi: "कोई स्रोत नहीं।" },
  drop_hint:          { en: "Drop a file or click to browse", nl: "Sleep een bestand of klik om te bladeren", de: "Datei ablegen oder klicken", fr: "Déposez un fichier ou cliquez", es: "Suelta un archivo o haz clic", pt: "Solte um arquivo ou clique", hi: "फ़ाइल छोड़ें या क्लिक करें" },
  supported:          { en: "PDF, TXT, MD — max 10 MB", nl: "PDF, TXT, MD — max 10 MB", de: "PDF, TXT, MD — max 10 MB", fr: "PDF, TXT, MD — max 10 Mo", es: "PDF, TXT, MD — máx 10 MB", pt: "PDF, TXT, MD — máx 10 MB", hi: "PDF, TXT, MD — अधिकतम 10 MB" },
  delete_confirm:     { en: "Delete this source?", nl: "Deze bron verwijderen?", de: "Quelle löschen?", fr: "Supprimer cette source?", es: "¿Eliminar esta fuente?", pt: "Excluir esta fonte?", hi: "यह स्रोत हटाएं?" },
  loading:            { en: "Loading…", nl: "Laden…", de: "Laden…", fr: "Chargement…", es: "Cargando…", pt: "Carregando…", hi: "लोड हो रहा है…" },
  not_found:          { en: "Notebook not found.", nl: "Notitieblok niet gevonden.", de: "Notizbuch nicht gefunden.", fr: "Cahier introuvable.", es: "Cuaderno no encontrado.", pt: "Caderno não encontrado.", hi: "नोटबुक नहीं मिली।" },
  error_type:         { en: "Only PDF, TXT and MD files are supported.", nl: "Alleen PDF, TXT en MD.", de: "Nur PDF, TXT und MD.", fr: "Seuls PDF, TXT et MD.", es: "Solo PDF, TXT y MD.", pt: "Apenas PDF, TXT e MD.", hi: "केवल PDF, TXT और MD।" },
  error_size:         { en: "File too large. Max 10 MB.", nl: "Bestand te groot. Max 10 MB.", de: "Datei zu groß. Max 10 MB.", fr: "Fichier trop volumineux.", es: "Archivo demasiado grande.", pt: "Arquivo muito grande.", hi: "फ़ाइल बहुत बड़ी है।" },
  error_upload:       { en: "Upload failed. Try again.", nl: "Upload mislukt.", de: "Upload fehlgeschlagen.", fr: "Échec du téléversement.", es: "Error al subir.", pt: "Falha no envio.", hi: "अपलोड विफल।" },
  error_source:       { en: "Could not fetch this URL. Try another.", nl: "Kon deze URL niet ophalen.", de: "URL konnte nicht abgerufen werden.", fr: "Impossible de récupérer cette URL.", es: "No se pudo obtener esta URL.", pt: "Não foi possível buscar esta URL.", hi: "यह URL प्राप्त नहीं हो सका।" },
  error_url:          { en: "Enter a valid URL.", nl: "Voer een geldige URL in.", de: "Gib eine gültige URL ein.", fr: "Entrez une URL valide.", es: "Ingresa una URL válida.", pt: "Digite uma URL válida.", hi: "एक मान्य URL दर्ज करें।" },
  cancel:             { en: "Cancel", nl: "Annuleren", de: "Abbrechen", fr: "Annuler", es: "Cancelar", pt: "Cancelar", hi: "रद्द करें" },
} as const;

function tr(key: keyof typeof T, lang: string): string {
  const l = lang as Lang;
  return (T[key] as Record<Lang, string>)[l] ?? (T[key] as Record<Lang, string>)["en"];
}

const ALLOWED_TYPES = ["application/pdf", "text/plain", "text/markdown"];
const ALLOWED_EXTS = [".pdf", ".txt", ".md"];
const MAX_SIZE = 10 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file: File): "ok" | "type" | "size" {
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const typeOk = ALLOWED_TYPES.includes(file.type) || ALLOWED_EXTS.includes(ext);
  if (!typeOk) return "type";
  if (file.size > MAX_SIZE) return "size";
  return "ok";
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/)/.test(url);
}

function sourceIcon(doc: BrainDocument): string {
  if (doc.source_url) return isYouTubeUrl(doc.source_url) ? "▶️" : "🔗";
  if (doc.file_type === "text/note") return "✏️";
  if (doc.file_type === "application/pdf") return "📄";
  if (doc.file_type === "text/markdown") return "📝";
  return "📃";
}

function sourceBadge(doc: BrainDocument): string {
  if (doc.source_url) return isYouTubeUrl(doc.source_url) ? "YT" : "URL";
  if (doc.file_type === "text/note") return "NOTE";
  if (doc.file_type === "application/pdf") return "PDF";
  if (doc.file_type === "text/markdown") return "MD";
  return "TXT";
}

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFetching, setSourceFetching] = useState(false);
  const [sourceError, setSourceError] = useState("");

  // Note modal
  const [showNote, setShowNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const noteBodyRef = useRef<HTMLTextAreaElement>(null);

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

  useEffect(() => {
    if (!authed || !notebookId) return;
    fetch(`/api/brain/notebooks?id=${encodeURIComponent(notebookId)}`, { credentials: "same-origin", cache: "no-store" })
      .then(async r => {
        if (!r.ok) { setNotebook(null); return; }
        const d = await r.json();
        setNotebook(d.notebook ?? null);
      })
      .catch(() => setNotebook(null))
      .finally(() => setNotebookLoading(false));
  }, [authed, notebookId]);

  useEffect(() => {
    if (!authed || !notebookId) return;
    fetch(`/api/brain/documents?notebookId=${encodeURIComponent(notebookId)}`, { credentials: "same-origin", cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setDocs(d.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [authed, notebookId]);

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
      const res = await fetch("/api/brain/documents", { method: "POST", credentials: "same-origin", body: form });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDocs(prev => [d.document, ...prev]);
      setNotebook(prev => prev ? { ...prev, document_count: prev.document_count + 1 } : prev);
    } catch { setUploadError(tr("error_upload", lang)); }
    finally { setUploading(false); }
  }

  async function handleAddSource() {
    const url = sourceUrl.trim();
    if (!url || !isValidUrl(url)) { setSourceError(tr("error_url", lang)); return; }
    setSourceError("");
    setSourceFetching(true);
    try {
      const res = await fetch("/api/brain/sources", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, notebookId }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDocs(prev => [d.document, ...prev]);
      setNotebook(prev => prev ? { ...prev, document_count: prev.document_count + 1 } : prev);
      setShowSource(false);
      setSourceUrl("");
    } catch { setSourceError(tr("error_source", lang)); }
    finally { setSourceFetching(false); }
  }

  async function handleDelete(docId: string) {
    setConfirmDeleteId(docId);
  }

  async function confirmDelete() {
    const docId = confirmDeleteId;
    if (!docId) return;
    setConfirmDeleteId(null);
    setDeletingId(docId);
    try {
      await fetch(`/api/brain/documents?id=${encodeURIComponent(docId)}&notebookId=${encodeURIComponent(notebookId)}`, { method: "DELETE", credentials: "same-origin" });
      setDocs(prev => prev.filter(d => d.id !== docId));
      setNotebook(prev => prev ? { ...prev, document_count: Math.max(0, prev.document_count - 1) } : prev);
    } finally { setDeletingId(null); }
  }

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [notebookId, lang]);

  useEffect(() => {
    if (showSource) setTimeout(() => sourceInputRef.current?.focus(), 60);
  }, [showSource]);

  useEffect(() => {
    if (showNote) setTimeout(() => noteBodyRef.current?.focus(), 60);
  }, [showNote]);

  async function handleSaveNote() {
    const body = noteBody.trim();
    if (!body) { setNoteError(tr("error_note", lang)); return; }
    setNoteError("");
    setNoteSaving(true);
    try {
      const res = await fetch("/api/brain/notes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, title: noteTitle.trim(), body }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setDocs(prev => [d.document, ...prev]);
      setNotebook(prev => prev ? { ...prev, document_count: prev.document_count + 1 } : prev);
      setShowNote(false);
      setNoteTitle("");
      setNoteBody("");
    } catch { setNoteError(tr("error_note_save", lang)); }
    finally { setNoteSaving(false); }
  }

  if (!authChecked || notebookLoading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-[#050510] text-white/40 text-sm">{tr("loading", lang)}</div>;
  }
  if (!authed) return null;
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

      <header className="sticky top-0 z-40 border-b border-white/6 bg-[#050510]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl flex items-center justify-between px-5 h-14">
          <a href="/brain" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M10 13L5 8l5-5" /></svg>
            {tr("back", lang)}
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/70 hover:border-white/16 hover:bg-white/[0.07] hover:text-white transition-all active:scale-95"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 4h10M3 8h10M3 12h6" />
              </svg>
              {tr("add_note", lang)}
            </button>
            <button
              type="button"
              onClick={() => setShowSource(true)}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/70 hover:border-white/16 hover:bg-white/[0.07] hover:text-white transition-all active:scale-95"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="8" cy="8" r="6" /><path d="M8 5v6M5 8h6" />
              </svg>
              {tr("add_source", lang)}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-4 py-1.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {uploading
                ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />{tr("uploading", lang)}</>
                : <><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 11V3M5 6l3-3 3 3" /><path d="M3 13h10" /></svg>{tr("upload", lang)}</>
              }
            </button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,text/plain,text/markdown,application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
      />

      <div className="mx-auto max-w-4xl px-5 pt-10 pb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-11 w-11 flex items-center justify-center rounded-[14px] bg-white/[0.06] text-2xl">{notebook.emoji}</div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{notebook.name}</h1>
            {notebook.description && <p className="text-sm text-white/36 mt-0.5">{notebook.description}</p>}
          </div>
        </div>
        <div className="ml-[56px] mt-3 flex items-center gap-3">
          <p className="text-xs text-white/24">{notebook.document_count} {tr("documents", lang).toLowerCase()}</p>
          <a
            href={`/personal-workspace?notebookId=${notebook.id}`}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] px-3.5 py-1.5 text-xs font-medium text-white shadow-[0_4px_12px_rgba(59,130,246,0.28)] hover:brightness-110 transition-all active:scale-95"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H2v12l3-3h9V2z" />
            </svg>
            Chat with notebook
          </a>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-5 pb-24 space-y-6">
        {uploadError && (
          <div className="rounded-[14px] border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-300 flex items-center justify-between">
            {uploadError}
            <button type="button" onClick={() => setUploadError("")} className="text-red-400/60 hover:text-red-300 ml-3">✕</button>
          </div>
        )}

        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`rounded-[20px] border-2 border-dashed px-8 py-10 text-center cursor-pointer transition-all ${dragging ? "border-[#3b82f6]/60 bg-[#3b82f6]/[0.06]" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"}`}
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
                <DocRow key={doc.id} doc={doc} deleting={deletingId === doc.id} onDelete={() => handleDelete(doc.id)} />
              ))}
            </div>
          )}
        </div>
      </main>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[24px] border border-white/10 bg-[#0a0f1e]/98 shadow-[0_24px_64px_rgba(0,0,0,0.50)] backdrop-blur-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <p className="text-sm font-medium text-white/90 mb-1">{tr("delete_confirm", lang)}</p>
              <p className="text-xs text-white/36">This cannot be undone.</p>
            </div>
            <div className="px-6 pb-6 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-[14px] bg-white/[0.04] py-2.5 text-sm text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                {tr("cancel", lang)}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 rounded-[14px] bg-red-500/20 border border-red-500/30 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showNote && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowNote(false); setNoteTitle(""); setNoteBody(""); setNoteError(""); } }}
        >
          <div className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#0a0f1e]/98 shadow-[0_24px_64px_rgba(0,0,0,0.50)] backdrop-blur-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30">{tr("note_modal_title", lang)}</p>
              <input
                type="text"
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
                placeholder={tr("note_title_ph", lang)}
                maxLength={100}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/24 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
              />
              <textarea
                ref={noteBodyRef}
                value={noteBody}
                onChange={e => { setNoteBody(e.target.value); setNoteError(""); }}
                onKeyDown={e => { if (e.key === "Escape") { setShowNote(false); setNoteTitle(""); setNoteBody(""); setNoteError(""); } }}
                placeholder={tr("note_body_ph", lang)}
                maxLength={20000}
                rows={7}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/24 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all resize-none"
              />
              {noteError && <p className="text-xs text-red-400">{noteError}</p>}
            </div>
            <div className="px-6 py-5 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowNote(false); setNoteTitle(""); setNoteBody(""); setNoteError(""); }}
                className="flex-1 rounded-[14px] bg-white/[0.04] py-2.5 text-sm text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                {tr("cancel", lang)}
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={noteSaving || !noteBody.trim()}
                className="flex-1 rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {noteSaving
                  ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />{tr("note_saving", lang)}</>
                  : tr("note_save", lang)
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {showSource && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowSource(false); setSourceUrl(""); setSourceError(""); } }}
        >
          <div className="w-full max-w-[440px] rounded-[28px] border border-white/10 bg-[#0a0f1e]/98 shadow-[0_24px_64px_rgba(0,0,0,0.50)] backdrop-blur-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-white/30 mb-1">{tr("source_modal_title", lang)}</p>
              <p className="text-xs text-white/36 mb-5">{tr("source_hint", lang)}</p>
              <input
                ref={sourceInputRef}
                type="url"
                value={sourceUrl}
                onChange={e => { setSourceUrl(e.target.value); setSourceError(""); }}
                onKeyDown={e => {
                  if (e.key === "Enter") handleAddSource();
                  if (e.key === "Escape") { setShowSource(false); setSourceUrl(""); setSourceError(""); }
                }}
                placeholder={tr("source_ph", lang)}
                className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/24 outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.06] transition-all"
              />
              {sourceError && <p className="text-xs text-red-400 mt-2">{sourceError}</p>}
            </div>
            <div className="px-6 py-5 flex gap-2">
              <button
                type="button"
                onClick={() => { setShowSource(false); setSourceUrl(""); setSourceError(""); }}
                className="flex-1 rounded-[14px] bg-white/[0.04] py-2.5 text-sm text-white/50 hover:bg-white/[0.08] hover:text-white transition-all"
              >
                {tr("cancel", lang)}
              </button>
              <button
                type="button"
                onClick={handleAddSource}
                disabled={sourceFetching || !sourceUrl.trim()}
                className="flex-1 rounded-[14px] bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(59,130,246,0.28)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {sourceFetching
                  ? <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />{tr("adding_source", lang)}</>
                  : tr("add_btn", lang)
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, deleting, onDelete }: { doc: BrainDocument; deleting: boolean; onDelete: () => void }) {
  const date = new Date(doc.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return (
    <div className={`group flex items-center gap-4 rounded-[16px] border border-white/8 bg-white/[0.025] px-4 py-3 transition-all hover:border-white/12 hover:bg-white/[0.04] ${deleting ? "opacity-40 pointer-events-none" : ""}`}>
      <span className="text-xl shrink-0">{sourceIcon(doc)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/88 truncate">{doc.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-white/28">{formatBytes(doc.file_size)} · {date}</p>
          {doc.source_url && (
            <a href={doc.source_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="text-[11px] text-[#93c5fd]/50 hover:text-[#93c5fd] transition-colors truncate max-w-[160px]">
              {doc.source_url.replace(/^https?:\/\//, "").slice(0, 40)}
            </a>
          )}
        </div>
      </div>
      <div className="shrink-0 px-2 py-0.5 rounded-full bg-white/[0.04] text-[10px] text-white/30 uppercase tracking-wide">{sourceBadge(doc)}</div>
      <button type="button" onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-full text-white/20 hover:text-red-400 hover:bg-white/[0.06] transition-all">
        <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M2 2l10 10M12 2L2 12" /></svg>
      </button>
    </div>
  );
}