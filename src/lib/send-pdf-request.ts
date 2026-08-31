export async function sendPdfByEmail(email: string): Promise<void> {
  const response = await fetch("/api/send-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
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
