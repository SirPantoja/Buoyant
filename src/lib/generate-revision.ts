import Anthropic from "@anthropic-ai/sdk";
import { fetch as undiciFetch } from "undici";

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

// Wraps undici's fetch (Node's own implementation, used explicitly rather
// than the ambient global one - a production Next.js server patches
// globalThis.fetch for its own Data Cache/tracing before route handlers
// run) so every response's status/headers/first bytes get logged. The
// hiring proxy has been returning a corrupted (invalid-UTF-8) body under
// a Content-Type: application/json header consistently, and swapping the
// fetch implementation alone didn't change that - so the corruption is
// most likely already present on the wire, not introduced client-side.
// This logs what's actually needed to tell a Content-Encoding mismatch
// (compressed bytes served as if they were plain text, or vice versa)
// apart from anything else, on the next occurrence.
async function diagnosticFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const response = await undiciFetch(input as never, init as never);
  try {
    const headers = Object.fromEntries(response.headers.entries());
    const firstBytes = new Uint8Array(await response.clone().arrayBuffer()).slice(0, 24);
    console.error("generateRevision: hiring proxy response metadata", {
      status: response.status,
      headers,
      firstBytesHex: Array.from(firstBytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(" "),
    });
  } catch (diagnosticError) {
    console.error("generateRevision: failed to log response diagnostics", diagnosticError);
  }
  return response as unknown as Response;
}

export async function generateRevision(currentText: string, instructions: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
    return DUMMY_AI_RESPONSE;
  }
  assertValidHeaderValue(apiKey, "ANTHROPIC_API_KEY");

  // The hiring proxy sits behind Cloudflare in front of a Railway-hosted
  // LiteLLM relay (seen via response headers: cf-ray, server: railway-hikari,
  // x-litellm-*), and its responses have come back with a Vary: Accept-Encoding
  // header but no Content-Encoding header at all, while the body itself is
  // binary and doesn't decode as UTF-8 text. Vary: Accept-Encoding without a
  // matching Content-Encoding is the signature of a response that was
  // compressed (most likely Brotli, which - unlike gzip/deflate/zstd - has no
  // fixed magic number, matching what showed up on the wire) somewhere in
  // that chain while the header naming what codec was used got dropped
  // before it reached us. Asking for identity encoding sidesteps the whole
  // class of bug regardless of which hop is responsible.
  const client = new Anthropic({
    apiKey,
    baseURL: HIRING_PROXY_BASE_URL,
    fetch: diagnosticFetch as unknown as typeof fetch,
    defaultHeaders: { "Accept-Encoding": "identity" },
  });
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
