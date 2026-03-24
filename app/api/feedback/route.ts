import { NextResponse } from "next/server";

let feedbackStore: any[] = [];

export async function POST(req: Request) {
  const data = await req.json();

  feedbackStore.push({
    ...data,
    timestamp: Date.now(),
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json(feedbackStore);
}