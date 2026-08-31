import { describe, expect, it } from "vitest";
import { extractOcrParagraphs, groupLinesIntoParagraphs, type StyledLine } from "./pdf-paragraphs";
import type { RgbColor } from "./sample-color";

const black: RgbColor = { r: 10, g: 10, b: 10 };
const red: RgbColor = { r: 200, g: 20, b: 20 };

function line(overrides: Partial<StyledLine> & Pick<StyledLine, "text" | "yMin" | "yMax">): StyledLine {
  return {
    xMin: 0,
    xMax: 100,
    fontFamily: "sans-serif",
    fontSize: 12,
    color: black,
    ...overrides,
  };
}

describe("groupLinesIntoParagraphs", () => {
  it("merges consecutive lines with a normal same-paragraph gap", () => {
    const lines = [line({ text: "First line", yMin: 0, yMax: 12 }), line({ text: "Second line", yMin: 16, yMax: 28 })];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("First line Second line");
  });

  it("splits at a gap as small as the smallest real paragraph break measured on a scanned document", () => {
    // ~1.0x line height, the smallest gap-to-height ratio measured at an
    // actual paragraph break on a real scanned page run through OCR - the
    // threshold has to catch this, not just larger, more obvious gaps.
    const lines = [line({ text: "First paragraph", yMin: 0, yMax: 12 }), line({ text: "Second paragraph", yMin: 24, yMax: 36 })];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["First paragraph", "Second paragraph"]);
  });

  it("splits after a gap clearly wider than normal line spacing", () => {
    const lines = [line({ text: "First paragraph", yMin: 0, yMax: 12 }), line({ text: "Second paragraph", yMin: 42, yMax: 54 })];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["First paragraph", "Second paragraph"]);
  });

  it("splits on a font size change even with no extra gap", () => {
    const lines = [
      line({ text: "Heading", yMin: 0, yMax: 16, fontSize: 20 }),
      line({ text: "Body text", yMin: 17, yMax: 29, fontSize: 12 }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["Heading", "Body text"]);
  });

  it("does not split on a font family change alone", () => {
    const lines = [
      line({ text: "Body text", yMin: 0, yMax: 12, fontFamily: "serif" }),
      line({ text: "Different font", yMin: 13, yMax: 25, fontFamily: "monospace" }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
  });

  it("splits on a color change even with no extra gap or size change", () => {
    const lines = [
      line({ text: "Black text", yMin: 0, yMax: 12, color: black }),
      line({ text: "Red text", yMin: 13, yMax: 25, color: red }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["Black text", "Red text"]);
  });

  it("does not split on color sampling noise from rendering/recognition", () => {
    const lines = [
      line({ text: "First line", yMin: 0, yMax: 12, color: { r: 10, g: 10, b: 10 } }),
      line({ text: "Second line", yMin: 13, yMax: 25, color: { r: 25, g: 18, b: 20 } }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
  });

  it("does not split on font-size noise from rendering/recognition", () => {
    const lines = [
      line({ text: "First line", yMin: 0, yMax: 12, fontSize: 12 }),
      line({ text: "Second line", yMin: 13, yMax: 25, fontSize: 12.8 }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
  });

  it("carries the first line's style onto the resulting paragraph, formatted as a CSS color", () => {
    const lines = [line({ text: "Styled text", yMin: 0, yMax: 12, fontFamily: "serif", fontSize: 16, color: red })];

    const [paragraph] = groupLinesIntoParagraphs(lines);

    expect(paragraph.fontFamily).toBe("serif");
    expect(paragraph.fontSize).toBe(16);
    expect(paragraph.color).toBe("rgb(200, 20, 20)");
  });

  it("returns nothing for no lines", () => {
    expect(groupLinesIntoParagraphs([])).toEqual([]);
  });
});

describe("extractOcrParagraphs", () => {
  const sampleColor = () => black;

  it("flattens Tesseract's blocks/paragraphs/lines into paragraph boxes", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            {
              text: "ignored",
              bbox: { x0: 0, y0: 0, x1: 100, y1: 50 },
              lines: [
                { text: "First line", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
                { text: "Second line", bbox: { x0: 0, y0: 22, x1: 100, y1: 42 } },
              ],
            },
          ],
        },
      ],
    };

    const paragraphs = extractOcrParagraphs(page, sampleColor);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("First line Second line");
  });

  it("splits a Tesseract paragraph further when its lines' sizes diverge", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            {
              text: "ignored",
              bbox: { x0: 0, y0: 0, x1: 100, y1: 60 },
              lines: [
                { text: "Small line", bbox: { x0: 0, y0: 0, x1: 100, y1: 10 } },
                { text: "Much bigger line", bbox: { x0: 0, y0: 11, x1: 100, y1: 40 } },
              ],
            },
          ],
        },
      ],
    };

    const paragraphs = extractOcrParagraphs(page, sampleColor);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["Small line", "Much bigger line"]);
  });

  it("splits a Tesseract paragraph further when its lines' colors diverge", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            {
              text: "ignored",
              bbox: { x0: 0, y0: 0, x1: 100, y1: 42 },
              lines: [
                { text: "Black line", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
                { text: "Red line", bbox: { x0: 0, y0: 22, x1: 100, y1: 42 } },
              ],
            },
          ],
        },
      ],
    };

    const colorForLine: Record<string, RgbColor> = {
      "0,0": black,
      "0,22": red,
    };

    const paragraphs = extractOcrParagraphs(page, (xMin, _xMax, yMin) => colorForLine[`${xMin},${yMin}`] ?? black);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["Black line", "Red line"]);
  });

  it("returns nothing when Tesseract found no blocks", () => {
    expect(extractOcrParagraphs({ blocks: null }, sampleColor)).toEqual([]);
  });
});
