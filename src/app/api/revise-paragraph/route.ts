import { NextResponse } from "next/server";
import { generateRevision } from "@/lib/generate-revision";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).currentText !== "string" ||
    typeof (body as Record<string, unknown>).instructions !== "string"
  ) {
    return NextResponse.json({ error: "Expected currentText and instructions strings." }, { status: 400 });
  }

  const { currentText, instructions } = body as { currentText: string; instructions: string };

  if (instructions.trim().length === 0) {
    return NextResponse.json({ error: "Instructions can't be empty." }, { status: 400 });
  }

  let result: string;
  try {
    result = await generateRevision(currentText, instructions);
  } catch (err) {
    console.error("generateRevision failed", err);
    const message = err instanceof Error ? err.message : "Failed to generate a revision.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ result });
}
