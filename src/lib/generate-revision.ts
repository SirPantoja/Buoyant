import Anthropic from "@anthropic-ai/sdk";

// Stands in for a real AI call when ANTHROPIC_API_KEY isn't configured, so
// local dev and previews without a key still exercise the full edit flow.
export const DUMMY_AI_RESPONSE = "this is an ai edit";

const SIMULATED_LATENCY_MS = 2000;
const HIRING_PROXY_BASE_URL = "https://hiring-proxy.trybuoyant.ai/anthropic";
const MODEL = "claude-opus-5";

// HTTP header values must be Latin-1 (byte) strings. A key pasted through
// something with "smart" punctuation (Notion, Word, some browsers) can
// silently pick up a curly quote or an em dash in place of a hyphen, which
// then fails deep inside the fetch layer with an opaque "Cannot convert
// argument to a ByteString" error - check for it here so the failure is
// obvious instead of cryptic.
function assertValidHeaderValue(value: string, envVarName: string): void {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) {
      throw new Error(
        `${envVarName} contains a character that isn't valid in an HTTP header (at position ${i + 1}). ` +
          "This usually happens when a key is copy-pasted through an editor with \"smart\" punctuation, " +
          "turning a hyphen into a long dash or a straight quote into a curly one - re-paste the value as plain text.",
      );
    }
  }
}

export async function generateRevision(currentText: string, instructions: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
    return DUMMY_AI_RESPONSE;
  }
  assertValidHeaderValue(apiKey, "ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey, baseURL: HIRING_PROXY_BASE_URL });
  let response: Anthropic.Message;
  try {
    // Deliberately minimal request body (model/max_tokens/messages only) -
    // a newer field like output_config.effort is one plausible reason a
    // narrower proxy in front of the real API would choke on requests it
    // doesn't recognize, so keep this to what any Messages API version
    // supports until there's a confirmed reason to add more.
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
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
  } catch (error) {
    if (error instanceof SyntaxError) {
      // The SDK trusts the response's Content-Type header and calls
      // response.json() directly (see @anthropic-ai/sdk/internal/parse.js) -
      // if the hiring proxy claims application/json but actually sends back
      // something else (e.g. a mis-encoded or truncated body), JSON.parse
      // throws with the raw, often unreadable bytes quoted in the message.
      // That's not useful shown to a user, so log the original for
      // debugging and surface something actionable instead.
      console.error("generateRevision: hiring proxy returned a response that wasn't valid JSON", error);
      throw new Error("The AI service returned an unreadable response - this is usually temporary. Please try again.");
    }
    throw error;
  }

  const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
  if (!textBlock) {
    throw new Error("The AI didn't return any revised text.");
  }

  return textBlock.text.trim();
}
