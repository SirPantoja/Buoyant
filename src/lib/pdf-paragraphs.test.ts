import { describe, expect, it } from "vitest";
import { extractOcrParagraphs, groupTextItemsIntoParagraphs } from "./pdf-paragraphs";

// A pass-through viewport: PDF-space coordinates are already what we want
// to assert on, so the tests can reason about them directly.
const identityViewport = {
  convertToViewportRectangle: (rect: number[]) => rect,
};

function textItem(str: string, x: number, y: number, width: number, height: number, hasEOL: boolean) {
  return { str, transform: [1, 0, 0, 1, x, y], width, height, hasEOL };
}

describe("groupTextItemsIntoParagraphs", () => {
  it("joins items on the same line and keeps close lines in one paragraph", () => {
    const items = [
      // Line 1
      textItem("Hello ", 0, 100, 30, 10, false),
      textItem("world", 30, 100, 25, 10, true),
      // Line 2, close enough to line 1 to be the same paragraph
      textItem("Second line", 0, 88, 60, 10, true),
    ];

    const paragraphs = groupTextItemsIntoParagraphs(items, identityViewport);

    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0].text).toBe("Hello world Second line");
  });

  it("starts a new paragraph after a large vertical gap", () => {
    const items = [
      textItem("First paragraph", 0, 200, 80, 10, true),
      // Large gap below (normal line gap here is ~12, this is 40)
      textItem("Second paragraph", 0, 160, 90, 10, true),
    ];

    const paragraphs = groupTextItemsIntoParagraphs(items, identityViewport);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].text).toBe("First paragraph");
    expect(paragraphs[1].text).toBe("Second paragraph");
  });

  it("computes a bounding box covering every line in the paragraph", () => {
    const items = [
      textItem("Short", 10, 100, 20, 10, true),
      textItem("A much longer second line", 10, 88, 70, 10, true),
    ];

    const [paragraph] = groupTextItemsIntoParagraphs(items, identityViewport);

    expect(paragraph.x).toBe(10);
    expect(paragraph.width).toBe(70);
    expect(paragraph.y).toBe(88);
    expect(paragraph.height).toBe(22); // from y=88 up to y=100+10=110
  });

  it("returns nothing for a page with no text", () => {
    expect(groupTextItemsIntoParagraphs([], identityViewport)).toEqual([]);
  });
});

describe("extractOcrParagraphs", () => {
  it("flattens Tesseract's blocks/paragraphs into paragraph boxes", () => {
    const page = {
      blocks: [
        {
          paragraphs: [
            { text: "First paragraph\n", bbox: { x0: 0, y0: 0, x1: 100, y1: 20 } },
            { text: "Second paragraph", bbox: { x0: 0, y0: 30, x1: 100, y1: 50 } },
          ],
        },
        {
          paragraphs: [{ text: "  ", bbox: { x0: 0, y0: 60, x1: 100, y1: 80 } }],
        },
      ],
    };

    const paragraphs = extractOcrParagraphs(page);

    expect(paragraphs).toEqual([
      { text: "First paragraph", x: 0, y: 0, width: 100, height: 20 },
      { text: "Second paragraph", x: 0, y: 30, width: 100, height: 20 },
    ]);
  });

  it("returns nothing when Tesseract found no blocks", () => {
    expect(extractOcrParagraphs({ blocks: null })).toEqual([]);
  });
});
