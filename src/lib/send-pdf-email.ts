import { Resend } from "resend";

// Real email delivery via Resend (https://resend.com). Requires
// RESEND_API_KEY to be set - locally in .env.local (gitignored, never
// committed), in production via the hosting platform's own environment
// variable settings.
//
// Sends from Resend's shared onboarding@resend.dev address, since no
// custom domain is verified for this project. Resend only allows that
// address to send to the account's own verified email until a domain is
// verified - sending to any other address will fail with a clear error
// from Resend itself, surfaced by the try/catch around this call in
// src/app/api/send-pdf/route.ts.
export async function sendPdfEmail(email: string, pdfBytes: Uint8Array, fileName: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email sending isn't configured yet (missing RESEND_API_KEY).");
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: "Buoyant <onboarding@resend.dev>",
    to: email,
    subject: "Your edited PDF from Buoyant",
    text: "Attached is your PDF with the requested revisions applied.",
    attachments: [{ filename: fileName, content: Buffer.from(pdfBytes) }],
  });

  if (error) {
    throw new Error(error.message);
  }
}
