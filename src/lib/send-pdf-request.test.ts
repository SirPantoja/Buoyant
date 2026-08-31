import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPdfByEmail } from "./send-pdf-request";

describe("sendPdfByEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the email address and resolves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPdfByEmail("someone@example.com")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/send-pdf",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "someone@example.com" }),
      }),
    );
  });

  it("throws with the server's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Enter a valid email address." }),
      }),
    );

    await expect(sendPdfByEmail("not-an-email")).rejects.toThrow("Enter a valid email address.");
  });

  it("throws a plain error instead of crashing when the response body isn't valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      }),
    );

    await expect(sendPdfByEmail("someone@example.com")).rejects.toThrow("Request failed (502)");
  });
});
