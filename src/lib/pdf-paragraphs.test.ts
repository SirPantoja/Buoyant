import { describe, expect, it } from "vitest";
import { extractOcrParagraphs, groupLinesIntoParagraphs, type StyledLine } from "./pdf-paragraphs";
import type { RgbColor } from "./sample-color";

const black: RgbColor = { r: 10, g: 10, b: 10 };
const nearlyBlack: RgbColor = { r: 5, g: 15, b: 8 }; // within tolerance of black
const red: RgbColor = { r: 200, g: 20, b: 20 }; // far from black

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
  it("merges consecutive lines with matching style and a small gap", () => {
    const lines = [
      line({ text: "First line", yMin: 0, yMax: 12 }),
      line({ text: "Second line", yMin: 13, yMax: 25 }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("First line Second line");
  });

  it("starts a new paragraph after a large vertical gap", () => {
    const lines = [
      line({ text: "First paragraph", yMin: 0, yMax: 12 }),
      line({ text: "Second paragraph", yMin: 40, yMax: 52 }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.map((p) => p.text)).toEqual(["First paragraph", "Second paragraph"]);
  });

  it("does not split on a font family change alone", () => {
    const lines = [
      line({ text: "Body text", yMin: 0, yMax: 12, fontFamily: "serif" }),
      line({ text: "Heading font", yMin: 13, yMax: 25, fontFamily: "monospace" }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
  });

  it("does not split on a font size change alone", () => {
    const lines = [
      line({ text: "Small text", yMin: 0, yMax: 10, fontSize: 10 }),
      line({ text: "Big text", yMin: 11, yMax: 30, fontSize: 20 }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(1);
  });

  it("splits on a clearly different color even with no extra gap", () => {
    const lines = [
      line({ text: "Black text", yMin: 0, yMax: 12, color: black }),
      line({ text: "Red text", yMin: 13, yMax: 25, color: red }),
    ];

    const paragraphs = groupLinesIntoParagraphs(lines);

    expect(paragraphs).toHaveLength(2);
  });

  it("does not split on color noise from pixel sampling", () => {
    const lines = [
      line({ text: "First line", yMin: 0, yMax: 12, color: black }),
      line({ text: "Second line", yMin: 13, yMax: 25, color: nearlyBlack }),
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

  it("does not split a Tesseract paragraph just because its lines' sizes diverge", () => {
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

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("Small line Much bigger line");
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
  });

  it("returns nothing when Tesseract found no blocks", () => {
    expect(extractOcrParagraphs({ blocks: null }, sampleColor)).toEqual([]);
  });
});
