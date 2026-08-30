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

  const data: { result?: string; error?: string } = await response.json();

  if (!response.ok || typeof data.result !== "string") {
    throw new Error(data.error ?? "Failed to get a revision.");
  }

  return data.result;
}
