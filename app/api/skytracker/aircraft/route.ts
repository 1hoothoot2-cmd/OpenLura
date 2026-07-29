import { NextRequest, NextResponse } from "next/server";
import { normalizeViewportBounds } from "@/features/skytracker/backend/domain/viewportBounds";
import { resolveSkyTrackerApiConfig } from "@/features/skytracker/backend/infrastructure/skyTrackerApiConfig";
import { aircraftProxyCacheHeaders } from "@/features/skytracker/backend/infrastructure/aircraftProxyCache";
import {
  getLocalTestScenario,
  isLocalTestEnvironment,
} from "@/features/skytracker/local-test/localTestEnvironment";

const UPSTREAM_TIMEOUT_MILLIS = 14_000;
const FORWARDED_RESPONSE_HEADERS = [
  "cache-control",
  "content-type",
  "etag",
  "x-cache-status",
  "x-request-id",
] as const;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const localTest = isLocalTestEnvironment();
  const localScenario = localTest ? getLocalTestScenario() : "normal";
  if (localScenario === "timeout") {
    return problem(504, "Backend timeout", "Simulated local backend timeout.");
  }
  if (localScenario === "provider-unavailable") {
    return problem(503, "Provider unavailable", "Simulated local provider failure.");
  }
  if (localScenario === "budget-exceeded") {
    const response = problem(503, "Budget exceeded", "Simulated local Budget Gate block.");
    response.headers.set("X-Cache-Status", "budget-blocked");
    return response;
  }
  const config = resolveSkyTrackerApiConfig(
    process.env.SKYTRACKER_API_BASE_URL,
    localTest ? "development" : process.env.NODE_ENV,
  );
  if (!config.configured) {
    return problem(503, "Backend unavailable", "SkyTracker backend configuration is unavailable.");
  }

  const bounds = normalizeViewportBounds({
    minLat: Number(request.nextUrl.searchParams.get("minLat")),
    minLon: Number(request.nextUrl.searchParams.get("minLon")),
    maxLat: Number(request.nextUrl.searchParams.get("maxLat")),
    maxLon: Number(request.nextUrl.searchParams.get("maxLon")),
  });
  if (!bounds.valid) {
    return problem(400, "Invalid viewport", "The requested viewport is invalid or too large.");
  }

  const upstreamUrl = new URL("/v1/aircraft", `${config.baseUrl}/`);
  for (const [key, value] of Object.entries(bounds.bounds)) {
    upstreamUrl.searchParams.set(key, String(value));
  }

  const controller = new AbortController();
  const abortFromClient = () => controller.abort(request.signal.reason);
  if (request.signal.aborted) abortFromClient();
  else request.signal.addEventListener("abort", abortFromClient, { once: true });
  const timeout = setTimeout(() => controller.abort("upstream_timeout"), UPSTREAM_TIMEOUT_MILLIS);

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const headers = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    for (const [name, value] of Object.entries(
      aircraftProxyCacheHeaders(response.ok),
    )) {
      headers.set(name, value);
    }
    if (localScenario === "stale-cache") {
      headers.set("X-Cache-Status", "budget_stale_fallback");
    }
    if (localScenario === "empty" && response.ok) {
      const value = (await response.json()) as Record<string, unknown>;
      return Response.json(
        { ...value, aircraft: [] },
        { status: response.status, headers },
      );
    }
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    if (controller.signal.aborted && !request.signal.aborted) {
      return problem(504, "Backend timeout", "SkyTracker backend did not respond in time.");
    }
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return problem(
      502,
      "Backend unavailable",
      error instanceof Error
        ? "SkyTracker backend could not be reached."
        : "SkyTracker backend request failed.",
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abortFromClient);
  }
}

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    {
      type: "about:blank",
      title,
      status,
      detail,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/problem+json",
      },
    },
  );
}
