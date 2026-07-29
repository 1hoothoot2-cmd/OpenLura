import { NextResponse } from "next/server";
import {
  getLocalTestScenario,
  isLocalTestEnvironment,
  setLocalTestScenario,
} from "@/features/skytracker/local-test/localTestEnvironment";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isLocalTestEnvironment()) return unavailable();
  return NextResponse.json(
    { mode: "local-test", scenario: getLocalTestScenario() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isLocalTestEnvironment()) return unavailable();
  try {
    const body = (await request.json()) as { scenario?: unknown };
    return NextResponse.json(
      { mode: "local-test", scenario: setLocalTestScenario(body.scenario) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "invalid-local-test-scenario" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function unavailable() {
  return NextResponse.json(
    { error: "not-found" },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
