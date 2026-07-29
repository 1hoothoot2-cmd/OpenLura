import type { SkyGuideAnswer } from "../application/skyGuideAssistant.ts";
import type { SkyGuideContext } from "../domain/skyGuide.ts";

export type SkyGuideClientResult =
  | { kind: "answered"; answer: SkyGuideAnswer; remaining: number | null }
  | {
      kind: "rejected" | "rate-limited" | "unavailable";
      message: string;
      remaining: number | null;
    };

export async function askSkyGuide(
  query: string,
  context: SkyGuideContext,
  fetchImplementation: typeof fetch = fetch,
): Promise<SkyGuideClientResult> {
  try {
    const response = await fetchImplementation("/api/skytracker/skyguide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context }),
    });
    const remaining = parseRemaining(
      response.headers.get("x-skyguide-ratelimit-remaining"),
    );
    const body = (await response.json()) as Record<string, unknown>;
    if (response.ok) {
      return {
        kind: "answered",
        answer: body as unknown as SkyGuideAnswer,
        remaining,
      };
    }
    return {
      kind:
        response.status === 429
          ? "rate-limited"
          : response.status >= 500
            ? "unavailable"
            : "rejected",
      message:
        typeof body.message === "string"
          ? body.message
          : "SkyGuide is currently temporarily unavailable.",
      remaining,
    };
  } catch {
    return {
      kind: "unavailable",
      message: "SkyGuide is currently temporarily unavailable.",
      remaining: null,
    };
  }
}

function parseRemaining(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}
