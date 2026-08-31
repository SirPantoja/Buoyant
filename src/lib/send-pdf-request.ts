export async function sendPdfByEmail(email: string, pdfBytes: Uint8Array, fileName: string): Promise<void> {
  const formData = new FormData();
  formData.append("email", email);
  // Uint8Array isn't directly a valid Blob part in all environments, so
  // wrap it in an ArrayBuffer copy first.
  formData.append("pdf", new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" }), fileName);

  const response = await fetch("/api/send-pdf", {
    method: "POST",
    body: formData,
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
