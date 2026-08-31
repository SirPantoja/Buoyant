import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPdfEmail } from "./send-pdf-email";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

describe("sendPdfEmail", () => {
  const originalApiKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    sendMock.mockReset();
    process.env.RESEND_API_KEY = originalApiKey;
  });

  it("throws a clear error when RESEND_API_KEY isn't configured", async () => {
    delete process.env.RESEND_API_KEY;

    await expect(
      sendPdfEmail("someone@example.com", "https://example.public.blob.vercel-storage.com/edited.pdf", "edited.pdf"),
    ).rejects.toThrow("RESEND_API_KEY");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends the blob URL as a path-based attachment", async () => {
    process.env.RESEND_API_KEY = "test-key";
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });

    const pdfUrl = "https://example.public.blob.vercel-storage.com/edited.pdf";
    await sendPdfEmail("someone@example.com", pdfUrl, "edited.pdf");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "someone@example.com",
        attachments: [{ path: pdfUrl, filename: "edited.pdf" }],
      }),
    );
  });

  it("throws with Resend's own error message on failure", async () => {
    process.env.RESEND_API_KEY = "test-key";
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "You can only send testing emails to your own email address." },
    });

    await expect(
      sendPdfEmail(
        "someone-else@example.com",
        "https://example.public.blob.vercel-storage.com/edited.pdf",
        "edited.pdf",
      ),
    ).rejects.toThrow("You can only send testing emails to your own email address.");
  });
});
