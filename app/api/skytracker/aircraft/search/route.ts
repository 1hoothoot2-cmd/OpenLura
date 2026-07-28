import { type NextRequest, NextResponse } from "next/server";
import { resolveSkyTrackerApiConfig } from "@/features/skytracker/backend/infrastructure/skyTrackerApiConfig";

const UPSTREAM_TIMEOUT_MILLIS = 14_000;
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "x-cache-status",
  "x-request-id",
] as const;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!/^[a-z0-9-]{2,16}$/i.test(query)) {
    return problem(400, "Invalid search", "Use 2 to 16 letters, numbers or hyphens.");
  }
  const config = resolveSkyTrackerApiConfig();
  if (!config.configured) {
    return problem(503, "Backend unavailable", "SkyTracker backend configuration is unavailable.");
  }

  const upstreamUrl = new URL("/v1/aircraft/search", `${config.baseUrl}/`);
  upstreamUrl.searchParams.set("q", query);
  const controller = new AbortController();
  const abortFromClient = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortFromClient();
  else request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(
    () => controller.abort("upstream_timeout"),
    UPSTREAM_TIMEOUT_MILLIS,
  );

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const headers = new Headers({
      "Cache-Control": "private, no-store",
    });
    if (response.ok) {
      headers.set(
        "Vercel-CDN-Cache-Control",
        "public, s-maxage=60, stale-while-revalidate=30",
      );
    }
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    if (controller.signal.aborted && !request.signal.aborted) {
      return problem(504, "Backend timeout", "SkyTracker backend did not respond in time.");
    }
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return problem(502, "Backend unavailable", "SkyTracker backend could not be reached.");
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  }
}

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json",
      },
    },
  );
}
