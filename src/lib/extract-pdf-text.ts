import { PDFParse } from "pdf-parse";

export const MIN_EMBEDDED_TEXT_LENGTH = 20;

export type PdfTextResult = { source: "embedded"; text: string } | { source: "ocr-required"; text: null };

// A PDF with little to no embedded text is likely a scan/image, so it
// needs OCR instead of the text layer this function just tried to read.
export async function extractPdfText(buffer: Buffer): Promise<PdfTextResult> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText({ pageJoiner: "" });
    const text = result.text.trim();

    if (text.length < MIN_EMBEDDED_TEXT_LENGTH) {
      return { source: "ocr-required", text: null };
    }

    return { source: "embedded", text };
  } finally {
    await parser.destroy();
  }
}
