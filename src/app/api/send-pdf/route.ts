import { NextResponse } from "next/server";
import { sendPdfEmail } from "@/lib/send-pdf-email";

// A plain, deliberately permissive shape check (something@something.something)
// rather than a full RFC 5322 validator - good enough to catch obvious
// typos without rejecting a real address the regex doesn't anticipate.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const email = formData.get("email");
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Expected an email address." }, { status: 400 });
  }

  const trimmedEmail = email.trim();
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const pdf = formData.get("pdf");
  if (!(pdf instanceof File)) {
    return NextResponse.json({ error: "No PDF was provided." }, { status: 400 });
  }

  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());

  try {
    await sendPdfEmail(trimmedEmail, pdfBytes, pdf.name || "edited.pdf");
  } catch (err) {
    console.error("sendPdfEmail failed", err);
    const message = err instanceof Error ? err.message : "Failed to send the email.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
