import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractPdfText } from "./extract-pdf-text";

const fixturesDir = path.join(__dirname, "__fixtures__");

describe("extractPdfText", () => {
  it("reads the embedded text layer from a digital PDF", async () => {
    const buffer = readFileSync(path.join(fixturesDir, "digital.pdf"));

    const result = await extractPdfText(buffer);

    expect(result.source).toBe("embedded");
    expect(result.text).toBe("Hello from a digital PDF!");
  });

  it("flags a scanned PDF (no embedded text) as needing OCR", async () => {
    const buffer = readFileSync(path.join(fixturesDir, "scanned-book-page.pdf"));

    const result = await extractPdfText(buffer);

    expect(result.source).toBe("ocr-required");
    expect(result.text).toBeNull();
  });
});
