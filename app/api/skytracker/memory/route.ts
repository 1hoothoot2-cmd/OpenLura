import { NextResponse } from "next/server";
import { requireOpenLuraIdentity } from "@/lib/auth/requestIdentity";
import { MemoryManager } from "@/features/skytracker/personal-platform/application/memoryManager";
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
} from "@/features/skytracker/personal-platform/domain/memory";
import {
  SupabaseMemoryRepository,
  SupabasePreferencesRepository,
  createSupabaseRepositoryConfig,
} from "@/features/skytracker/personal-platform/infrastructure/supabaseRepositories";
import type {
  AviationExpertise,
  ConversationStyle,
} from "@/features/skytracker/personal-platform/domain/preferences";

export const dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const context = await managerFor(request);
  if (!context) return unauthorized();
  try {
    return NextResponse.json(
      { memory: await context.manager.get(context.userId) },
      { headers: HEADERS },
    );
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  const context = await managerFor(request);
  if (!context) return unauthorized();
  try {
    const body = await request.json() as Record<string, unknown>;
    if (
      typeof body.category !== "string" ||
      !MEMORY_CATEGORIES.includes(body.category as MemoryCategory) ||
      typeof body.value !== "string"
    ) return invalid();
    await context.manager.add(
      context.userId,
      body.category as MemoryCategory,
      body.value,
      typeof body.label === "string" ? body.label : null,
    );
    return NextResponse.json(
      { memory: await context.manager.get(context.userId) },
      { headers: HEADERS },
    );
  } catch {
    return invalid();
  }
}

export async function PATCH(request: Request) {
  const context = await managerFor(request);
  if (!context) return unauthorized();
  try {
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.id === "string" && typeof body.value === "string") {
      if (
        typeof body.category !== "string" ||
        !MEMORY_CATEGORIES.includes(body.category as MemoryCategory)
      ) return invalid();
      await context.manager.update(
        context.userId,
        body.id,
        body.category as MemoryCategory,
        body.value,
        typeof body.label === "string" ? body.label : null,
      );
    } else if (
      typeof body.language === "string" &&
      isUnits(body.preferredUnits)
    ) {
      await context.manager.updateUserPreferences(
        context.userId,
        body.language,
        body.preferredUnits,
      );
    } else {
      if (
        !["beginner", "enthusiast", "professional"].includes(String(body.expertiseLevel)) ||
        !["concise", "balanced", "technical"].includes(String(body.conversationStyle))
      ) return invalid();
      await context.manager.updateAiPreferences(
        context.userId,
        body.expertiseLevel as AviationExpertise,
        body.conversationStyle as ConversationStyle,
      );
    }
    return NextResponse.json(
      { memory: await context.manager.get(context.userId) },
      { headers: HEADERS },
    );
  } catch {
    return invalid();
  }
}

function isUnits(value: unknown): value is {
  distance: "kilometers" | "nautical-miles";
  altitude: "meters" | "feet";
  speed: "meters-per-second" | "knots";
} {
  if (!value || typeof value !== "object") return false;
  const units = value as Record<string, unknown>;
  return (
    ["kilometers", "nautical-miles"].includes(String(units.distance)) &&
    ["meters", "feet"].includes(String(units.altitude)) &&
    ["meters-per-second", "knots"].includes(String(units.speed))
  );
}

export async function DELETE(request: Request) {
  const context = await managerFor(request);
  if (!context) return unauthorized();
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) await context.manager.remove(context.userId, id);
    else if (url.searchParams.get("scope") === "memory") {
      await context.manager.clear(context.userId);
    } else return invalid();
    return NextResponse.json(
      { memory: await context.manager.get(context.userId) },
      { headers: HEADERS },
    );
  } catch {
    return invalid();
  }
}

async function managerFor(request: Request) {
  const identity = await requireOpenLuraIdentity(request);
  if (!identity.ok) return null;
  const config = createSupabaseRepositoryConfig(identity.identity.accessToken);
  return {
    userId: identity.identity.userId,
    manager: new MemoryManager(
      new SupabaseMemoryRepository(config),
      new SupabasePreferencesRepository(config),
    ),
  };
}

function unauthorized() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401, headers: HEADERS },
  );
}

function invalid() {
  return NextResponse.json(
    { error: "Invalid memory request" },
    { status: 400, headers: HEADERS },
  );
}

function unavailable() {
  return NextResponse.json(
    { error: "Memory is temporarily unavailable" },
    { status: 503, headers: HEADERS },
  );
}
