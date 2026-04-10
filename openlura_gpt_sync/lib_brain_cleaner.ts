// ─── Main cleaner ─────────────────────────────────────────────────────────────

export function cleanText(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw;

  // Remove null bytes and control characters (except newlines/tabs)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Normalize Windows line endings
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strip common web noise
  text = stripWebNoise(text);

  // Normalize unicode whitespace to regular spaces
  text = text.replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ");

  // Remove zero-width characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u2060]/g, "");

  // Collapse multiple spaces on the same line
  text = text.replace(/[ \t]{2,}/g, " ");

  // Collapse more than 2 consecutive newlines
  text = text.replace(/\n{3,}/g, "\n\n");

  // Trim each line
  text = text
    .split("\n")
    .map(line => line.trim())
    .join("\n");

  // Remove lines that are just punctuation/symbols (common in PDF artifacts)
  text = text
    .split("\n")
    .filter(line => {
      if (line.length === 0) return true; // keep empty lines (for spacing)
      if (line.length > 2) return true;   // keep substantive lines
      // Remove single-char lines that are just symbols
      return /[a-zA-Z0-9\u00C0-\u024F]/.test(line);
    })
    .join("\n");

  // Final trim
  text = text.trim();

  return text;
}

// ─── Web noise patterns ───────────────────────────────────────────────────────

const WEB_NOISE_PATTERNS = [
  // Cookie banners
  /(?:we use cookies|cookie policy|accept cookies|cookie consent)[\s\S]{0,300}/gi,
  // Newsletter popups
  /(?:subscribe to our newsletter|sign up for updates|enter your email)[\s\S]{0,200}/gi,
  // Navigation artifacts (lines that are just nav items)
  /^(?:home|about|contact|menu|search|login|sign in|sign up|log in|register)\s*$/gmi,
  // Copyright lines
  /©\s*\d{4}[\s\S]{0,100}(?:all rights reserved|rights reserved)/gi,
  // Share buttons
  /(?:share on|follow us on|tweet this|share this)[\s\S]{0,100}/gi,
  // "Read more" artifacts
  /\bread more\b[\s\S]{0,50}/gi,
  // Page numbers (common in PDFs)
  /^\s*(?:page\s*)?\d+\s*(?:of\s*\d+)?\s*$/gmi,
  // URL artifacts
  /https?:\/\/[^\s]{100,}/g,
];

function stripWebNoise(text: string): string {
  let result = text;
  for (const pattern of WEB_NOISE_PATTERNS) {
    result = result.replace(pattern, " ");
  }
  return result;
}

// ─── Quality check ────────────────────────────────────────────────────────────

export function isUsableContent(text: string): boolean {
  if (!text || text.trim().length < 50) return false;
  // Must have some real words (letters)
  const letterRatio = (text.match(/[a-zA-Z\u00C0-\u024F]/g)?.length ?? 0) / text.length;
  return letterRatio > 0.3;
}

// ─── Chunk helper (for 5.7.6) ─────────────────────────────────────────────────

export function estimateTokens(text: string): number {
  // ~4 chars per token (rough estimate)
  return Math.ceil(text.length / 4);
}