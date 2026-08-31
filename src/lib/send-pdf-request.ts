import { upload } from "@vercel/blob/client";

export async function sendPdfByEmail(email: string, pdfBytes: Uint8Array, fileName: string): Promise<void> {
  // Uploads directly from the browser to Vercel Blob storage rather than
  // to our own server: the actual PDF bytes never pass through a Vercel
  // Serverless Function (whose request body is capped at ~4.5 MB), only
  // a short-lived client token (requested via /api/blob-upload) and,
  // afterward, the small resulting URL.
  const blob = await upload(fileName, new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }), {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
  });

  const response = await fetch("/api/send-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, pdfUrl: blob.url, fileName }),
  });

  let data: { success?: boolean; error?: string };
  try {
    data = await response.json();
  } catch {
    // A non-JSON response (an empty body from a gateway timeout, a
    // platform-level rejection, etc.) never reaches our own JSON error
    // responses - report that plainly rather than crashing on the parse.
    throw new Error(`Request failed (${response.status}). Please try again.`);
  }

  if (!response.ok || data.success !== true) {
    throw new Error(data.error ?? "Failed to send the email.");
  }
}
