import { NextResponse } from "next/server";
import { sendPdfEmail } from "@/lib/send-pdf-email";

// A plain, deliberately permissive shape check (something@something.something)
// rather than a full RFC 5322 validator - good enough to catch obvious
// typos without rejecting a real address the regex doesn't anticipate.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).pdfUrl !== "string" ||
    typeof (body as Record<string, unknown>).fileName !== "string"
  ) {
    return NextResponse.json({ error: "Expected email, pdfUrl, and fileName strings." }, { status: 400 });
  }

  const { email, pdfUrl, fileName } = body as { email: string; pdfUrl: string; fileName: string };
  const trimmedEmail = email.trim();

  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    await sendPdfEmail(trimmedEmail, pdfUrl, fileName);
  } catch (err) {
    console.error("sendPdfEmail failed", err);
    const message = err instanceof Error ? err.message : "Failed to send the email.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
