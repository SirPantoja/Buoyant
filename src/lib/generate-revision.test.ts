import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock };
  },
}));

const { DUMMY_AI_RESPONSE, generateRevision } = await import("./generate-revision");

describe("generateRevision", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    createMock.mockReset();
  });

  describe("without ANTHROPIC_API_KEY set", () => {
    beforeEach(() => {
      delete process.env.ANTHROPIC_API_KEY;
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("resolves with the dummy response after a simulated delay, without calling the API", async () => {
      const promise = generateRevision("Original text", "Make it shorter");

      let resolved = false;
      promise.then(() => {
        resolved = true;
      });

      await vi.advanceTimersByTimeAsync(1000);
      expect(resolved).toBe(false);

      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toBe(DUMMY_AI_RESPONSE);
      expect(resolved).toBe(true);
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe("with ANTHROPIC_API_KEY set", () => {
    beforeEach(() => {
      process.env.ANTHROPIC_API_KEY = "test-key";
    });

    it("sends the paragraph and instructions to the hiring proxy and returns the revised text", async () => {
      createMock.mockResolvedValue({ content: [{ type: "text", text: "  Revised paragraph.  " }] });

      const result = await generateRevision("Original text", "Make it shorter");

      expect(result).toBe("Revised paragraph.");
      expect(createMock).toHaveBeenCalledTimes(1);
      const requestBody = createMock.mock.calls[0][0] as { messages: { role: string; content: string }[] };
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0].role).toBe("user");
      expect(requestBody.messages[0].content).toContain("Original text");
      expect(requestBody.messages[0].content).toContain("Make it shorter");
    });

    it("throws when the response contains no text block", async () => {
      createMock.mockResolvedValue({ content: [] });

      await expect(generateRevision("Original text", "Make it shorter")).rejects.toThrow(
        "didn't return any revised text",
      );
    });

    it("propagates errors from the API call", async () => {
      createMock.mockRejectedValue(new Error("network error"));

      await expect(generateRevision("Original text", "Make it shorter")).rejects.toThrow("network error");
    });

    it("replaces an unreadable (non-JSON) proxy response with a clear message", async () => {
      createMock.mockRejectedValue(new SyntaxError('Unexpected token \x1f, "\x1f$\x8b\x00..." is not valid JSON'));
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(generateRevision("Original text", "Make it shorter")).rejects.toThrow(
        "The AI service returned an unreadable response",
      );
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("fails clearly instead of calling the API when the key contains a non-Latin-1 character", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-abc—123";

      await expect(generateRevision("Original text", "Make it shorter")).rejects.toThrow("ANTHROPIC_API_KEY");
      expect(createMock).not.toHaveBeenCalled();
    });
  });
});
