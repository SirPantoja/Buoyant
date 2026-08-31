import { Resend } from "resend";

// Real email delivery via Resend (https://resend.com). Requires
// RESEND_API_KEY to be set - locally in .env.local (gitignored, never
// committed), in production via the hosting platform's own environment
// variable settings.
//
// Takes a URL rather than the PDF's raw bytes: the file is uploaded
// directly from the browser to Vercel Blob storage first (see
// send-pdf-request.ts), and Resend fetches it itself from that URL when
// sending - so the file never has to pass through our own server at all,
// avoiding Vercel's ~4.5 MB Serverless Function request-body limit (and
// Resend's own attachment size limit of ~40 MB per email becomes the real
// ceiling instead).
//
// Sends from Resend's shared onboarding@resend.dev address, since no
// custom domain is verified for this project. Resend only allows that
// address to send to the account's own verified email until a domain is
// verified - sending to any other address will fail with a clear error
// from Resend itself, surfaced by the try/catch around this call in
// src/app/api/send-pdf/route.ts.
export async function sendPdfEmail(email: string, pdfUrl: string, fileName: string): Promise<void> {
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
    attachments: [{ path: pdfUrl, filename: fileName }],
  });

  if (error) {
    throw new Error(error.message);
  }
}
