import Anthropic from "@anthropic-ai/sdk";

// Stands in for a real AI call when ANTHROPIC_API_KEY isn't configured, so
// local dev and previews without a key still exercise the full edit flow.
export const DUMMY_AI_RESPONSE = "this is an ai edit";

const SIMULATED_LATENCY_MS = 2000;
const HIRING_PROXY_BASE_URL = "https://hiring-proxy.trybuoyant.ai/anthropic";
const MODEL = "claude-opus-5";

export async function generateRevision(currentText: string, instructions: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
    return DUMMY_AI_RESPONSE;
  }

  const client = new Anthropic({ apiKey, baseURL: HIRING_PROXY_BASE_URL });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          "Revise the following paragraph according to the instructions.",
          "Respond with only the revised paragraph text - no preamble, no quotes, no explanation.",
          "",
          `Paragraph:\n"""\n${currentText}\n"""`,
          "",
          `Instructions: ${instructions}`,
        ].join("\n"),
      },
    ],
  });

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock) {
    throw new Error("The AI didn't return any revised text.");
  }

  return textBlock.text.trim();
}
