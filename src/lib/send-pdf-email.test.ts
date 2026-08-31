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

    await expect(sendPdfEmail("someone@example.com", new Uint8Array(), "edited.pdf")).rejects.toThrow(
      "RESEND_API_KEY",
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("sends the PDF bytes as a named attachment", async () => {
    process.env.RESEND_API_KEY = "test-key";
    sendMock.mockResolvedValue({ data: { id: "abc" }, error: null });

    const pdfBytes = new Uint8Array([1, 2, 3]);
    await sendPdfEmail("someone@example.com", pdfBytes, "edited.pdf");

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "someone@example.com",
        attachments: [{ filename: "edited.pdf", content: Buffer.from(pdfBytes) }],
      }),
    );
  });

  it("throws with Resend's own error message on failure", async () => {
    process.env.RESEND_API_KEY = "test-key";
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "You can only send testing emails to your own email address." },
    });

    await expect(sendPdfEmail("someone-else@example.com", new Uint8Array(), "edited.pdf")).rejects.toThrow(
      "You can only send testing emails to your own email address.",
    );
  });
});
