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

  if (typeof body !== "object" || body === null || typeof (body as Record<string, unknown>).email !== "string") {
    return NextResponse.json({ error: "Expected an email string." }, { status: 400 });
  }

  const email = (body as { email: string }).email.trim();

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  await sendPdfEmail(email);

  return NextResponse.json({ success: true });
}
