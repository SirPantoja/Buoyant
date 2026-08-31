import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectEmbeddedText } from "./detect-embedded-text";

const fixturesDir = path.join(__dirname, "__fixtures__");

async function openFixture(name: string) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(path.join(fixturesDir, name)));
  return pdfjsLib.getDocument({ data }).promise;
}

describe("detectEmbeddedText", () => {
  it("reads the embedded text layer from a digital PDF", async () => {
    const pdf = await openFixture("digital.pdf");

    const result = await detectEmbeddedText(pdf);

    expect(result.source).toBe("embedded");
    expect(result.text).toBe("Hello from a digital PDF!");
  });

  it("flags a scanned PDF (no embedded text) as needing OCR", async () => {
    const pdf = await openFixture("scanned-book-page.pdf");

    const result = await detectEmbeddedText(pdf);

    expect(result.source).toBe("ocr-required");
    expect(result.text).toBeNull();
  });
});
