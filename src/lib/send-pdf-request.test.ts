import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPdfByEmail } from "./send-pdf-request";

describe("sendPdfByEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the email address and PDF bytes as form data, and resolves on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPdfByEmail("someone@example.com", new Uint8Array([1, 2, 3]), "edited.pdf")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith("/api/send-pdf", expect.objectContaining({ method: "POST" }));
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("email")).toBe("someone@example.com");
    const pdfField = body.get("pdf");
    expect(pdfField).toBeInstanceOf(Blob);
    expect((pdfField as File).name).toBe("edited.pdf");
  });

  it("throws with the server's error message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Enter a valid email address." }),
      }),
    );

    await expect(sendPdfByEmail("not-an-email", new Uint8Array(), "edited.pdf")).rejects.toThrow(
      "Enter a valid email address.",
    );
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

    await expect(sendPdfByEmail("someone@example.com", new Uint8Array(), "edited.pdf")).rejects.toThrow(
      "Request failed (502)",
    );
  });
});
