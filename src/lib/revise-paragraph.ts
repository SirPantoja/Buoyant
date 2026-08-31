export type ReviseParagraphRequest = {
  currentText: string;
  instructions: string;
};

export async function reviseParagraph({ currentText, instructions }: ReviseParagraphRequest): Promise<string> {
  const response = await fetch("/api/revise-paragraph", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentText, instructions }),
  });

  let data: { result?: string; error?: string };
  try {
    data = await response.json();
  } catch {
    // A non-JSON response (an empty body from a gateway timeout, a
    // platform-level rejection, etc.) never reaches our own JSON error
    // responses - report that plainly rather than crashing on the parse.
    throw new Error(`Request failed (${response.status}). Please try again.`);
  }

  if (!response.ok || typeof data.result !== "string") {
    throw new Error(data.error ?? "Failed to get a revision.");
  }

  return data.result;
}
