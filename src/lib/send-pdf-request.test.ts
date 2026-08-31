import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPdfByEmail } from "./send-pdf-request";

const uploadMock = vi.fn();

vi.mock("@vercel/blob/client", () => ({
  upload: (...args: unknown[]) => uploadMock(...args),
}));

describe("sendPdfByEmail", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    uploadMock.mockReset();
  });

  it("uploads to Blob storage first, then posts the resulting URL and email address", async () => {
    uploadMock.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/edited-abc123.pdf" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendPdfByEmail("someone@example.com", new Uint8Array([1, 2, 3]), "edited.pdf")).resolves.toBeUndefined();

    expect(uploadMock).toHaveBeenCalledWith(
      "edited.pdf",
      expect.any(Blob),
      expect.objectContaining({ access: "public", handleUploadUrl: "/api/blob-upload" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/send-pdf",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "someone@example.com",
          pdfUrl: "https://example.public.blob.vercel-storage.com/edited-abc123.pdf",
          fileName: "edited.pdf",
        }),
      }),
    );
  });

  it("throws with the server's error message when the request fails", async () => {
    uploadMock.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/edited-abc123.pdf" });
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
    uploadMock.mockResolvedValue({ url: "https://example.public.blob.vercel-storage.com/edited-abc123.pdf" });
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
