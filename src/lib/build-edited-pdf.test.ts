import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildEditedPdf } from "./build-edited-pdf";
import { paragraphKey } from "./paragraph-edits";
import type { RenderedPage } from "./pdf-paragraphs";

const fixturesDir = path.join(__dirname, "__fixtures__");

function loadFixtureFile(name: string): File {
  const buffer = readFileSync(path.join(fixturesDir, name));
  return new File([buffer], name, { type: "application/pdf" });
}

// digital.pdf is a 400x200pt single page reading "Hello from a digital
// PDF!" - see extract-pdf-text.test.ts's history for where that text
// came from. The box below is an approximate position for it; exact
// pixel accuracy doesn't matter here, only that buildEditedPdf draws
// into a sensible spot on the real page.
function pageWithOneParagraph(): RenderedPage {
  return {
    dataUrl: "",
    width: 400,
    height: 200,
    paragraphs: [
      {
        text: "Hello from a digital PDF!",
        x: 20,
        y: 80,
        width: 300,
        height: 20,
        fontFamily: "sans-serif",
        fontSize: 14,
        color: "rgb(0, 0, 0)",
        backgroundColor: "rgb(255, 255, 255)",
      },
    ],
  };
}

async function extractText(bytes: Uint8Array): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  const items = textContent.items as unknown[];
  return items
    .filter((item): item is { str: string } => typeof (item as { str?: unknown }).str === "string")
    .map((item) => item.str)
    .join(" ");
}

describe("buildEditedPdf", () => {
  it("draws an edited paragraph's replacement text over the original PDF page", async () => {
    const file = loadFixtureFile("digital.pdf");
    const pages = [pageWithOneParagraph()];
    const editState = {
      [paragraphKey(0, 0)]: ["Hello from a digital PDF!", "Goodbye from an edited PDF!"],
    };

    const bytes = await buildEditedPdf(file, pages, editState);
    const text = await extractText(bytes);

    expect(text).toContain("Goodbye from an edited PDF!");
  });

  it("leaves a paragraph with no confirmed edits untouched", async () => {
    const file = loadFixtureFile("digital.pdf");
    const pages = [pageWithOneParagraph()];
    // Single-entry history (just the original) - hasEdits() treats this
    // as unedited, same as buildInitialEditState's starting state.
    const editState = { [paragraphKey(0, 0)]: ["Hello from a digital PDF!"] };

    const bytes = await buildEditedPdf(file, pages, editState);
    const text = await extractText(bytes);

    expect(text).toContain("Hello from a digital PDF!");
  });

  it("produces a page for each page of the original even when nothing on it was edited", async () => {
    const file = loadFixtureFile("digital.pdf");
    const bytes = await buildEditedPdf(file, [pageWithOneParagraph()], {});

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

    expect(pdf.numPages).toBe(1);
  });
});
