import { cleanText } from "./cleaner";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParseResult {
  text: string;
  charCount: number;
  truncated: boolean;
}

const MAX_CHARS = 150_000;

// ─── Markdown stripper ────────────────────────────────────────────────────────

function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")           // headers
    .replace(/\*\*(.+?)\*\*/g, "$1")        // bold
    .replace(/\*(.+?)\*/g, "$1")            // italic
    .replace(/~~(.+?)~~/g, "$1")            // strikethrough
    .replace(/`{3}[\s\S]*?`{3}/g, "")       // code blocks
    .replace(/`(.+?)`/g, "$1")              // inline code
    .replace(/!\[.*?\]\(.*?\)/g, "")        // images
    .replace(/\[(.+?)\]\(.*?\)/g, "$1")     // links → text only
    .replace(/^[-*+]\s+/gm, "")             // unordered lists
    .replace(/^\d+\.\s+/gm, "")             // ordered lists
    .replace(/^>\s+/gm, "")                 // blockquotes
    .replace(/^[-*_]{3,}$/gm, "")           // horizontal rules
    .replace(/\|.*?\|/g, " ")               // tables
    .trim();
}

// ─── PDF parser ───────────────────────────────────────────────────────────────

async function parsePdf(buffer: ArrayBuffer): Promise<string> {
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "";

    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item: any) => "str" in item)
        .map((item: any) => item.str)
        .join(" ");
      pages.push(pageText);
    }

    return pages.join("\n\n");
  } catch (err) {
    console.error("[Brain] PDF parse error", err instanceof Error ? err.message : "unknown");
    throw new Error("PDF parsing failed");
  }
}

// ─── Main parse function ──────────────────────────────────────────────────────

export async function parseDocument(
  buffer: ArrayBuffer,
  fileType: string,
  filename: string
): Promise<ParseResult> {
  let raw = "";

  const ext = filename.split(".").pop()?.toLowerCase();

  if (fileType === "application/pdf" || ext === "pdf") {
    raw = await parsePdf(buffer);
  } else if (fileType === "text/markdown" || ext === "md") {
    const text = new TextDecoder("utf-8").decode(buffer);
    raw = stripMarkdown(text);
  } else {
    // TXT and everything else
    raw = new TextDecoder("utf-8").decode(buffer);
  }

  const cleaned = cleanText(raw);
  const truncated = cleaned.length > MAX_CHARS;

  return {
    text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
    charCount: Math.min(cleaned.length, MAX_CHARS),
    truncated,
  };
}

// ─── Parse plain text (for notes/sources already in string form) ──────────────

export function parsePlainText(raw: string): ParseResult {
  const cleaned = cleanText(raw);
  const truncated = cleaned.length > MAX_CHARS;
  return {
    text: truncated ? cleaned.slice(0, MAX_CHARS) : cleaned,
    charCount: Math.min(cleaned.length, MAX_CHARS),
    truncated,
  };
}