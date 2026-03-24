import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { promises as fs } from "fs";
import path from "path";

const feedbackFilePath = path.join(process.cwd(), "data", "feedback.json");

async function ensureFeedbackFile() {
  const dir = path.dirname(feedbackFilePath);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.access(feedbackFilePath);
  } catch {
    await fs.writeFile(feedbackFilePath, "[]", "utf-8");
  }
}

async function readFeedbackFile() {
  await ensureFeedbackFile();

  try {
    const content = await fs.readFile(feedbackFilePath, "utf-8");
    return JSON.parse(content || "[]");
  } catch {
    return [];
  }
}

async function writeFeedbackFile(data: any[]) {
  await ensureFeedbackFile();
  await fs.writeFile(feedbackFilePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function POST(req: Request) {
  const data = await req.json();
  const existing = await readFeedbackFile();

  const entry = {
    ...data,
    timestamp: Date.now(),
  };

  existing.push(entry);
  await writeFeedbackFile(existing);

  return NextResponse.json({ success: true, item: entry });
}

export async function GET() {
  const data = await readFeedbackFile();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}