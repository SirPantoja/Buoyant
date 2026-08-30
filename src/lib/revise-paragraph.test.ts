import { afterEach, describe, expect, it, vi } from "vitest";
import { reviseParagraph } from "./revise-paragraph";

describe("reviseParagraph", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the current text and instructions, and returns the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: "this is an ai edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviseParagraph({ currentText: "Original", instructions: "Make it punchier" });

    expect(result).toBe("this is an ai edit");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/revise-paragraph",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ currentText: "Original", instructions: "Make it punchier" }),
      }),
    );
  });

  it("throws with the server's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Instructions can't be empty." }),
      }),
    );

    await expect(reviseParagraph({ currentText: "Original", instructions: "" })).rejects.toThrow(
      "Instructions can't be empty.",
    );
  });
});
