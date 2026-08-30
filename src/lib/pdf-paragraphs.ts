export type ParagraphBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// A single rendered PDF page, ready to display with clickable/hoverable
// paragraph regions overlaid on top of it.
export type RenderedPage = {
  dataUrl: string;
  width: number;
  height: number;
  paragraphs: ParagraphBox[];
};

type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
};

type ViewportLike = {
  convertToViewportRectangle(rect: number[]): number[];
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Groups a page's text items (as returned by pdf.js's getTextContent) into
// lines using each item's hasEOL flag, then groups consecutive lines into
// paragraphs wherever the gap between baselines is much larger than a
// normal line-height. There's no "paragraph" concept in the PDF text
// stream, so this is a heuristic, not an exact structural read.
export function groupTextItemsIntoParagraphs(
  items: TextItemLike[],
  viewport: ViewportLike,
): ParagraphBox[] {
  const lines: TextItemLike[][] = [];
  let currentLine: TextItemLike[] = [];

  for (const item of items) {
    // pdf.js marks a line break with a trailing empty-string item whose own
    // position belongs to the *next* line, so it must not contribute to
    // this line's geometry - only real text does.
    if (item.str.length > 0) {
      currentLine.push(item);
    }
    if (item.hasEOL && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  const lineBoxes = lines
    .map((lineItems) => {
      const text = lineItems
        .map((i) => i.str)
        .join("")
        .trim();
      const baseline = lineItems[0].transform[5];
      return {
        text,
        baseline,
        xMin: Math.min(...lineItems.map((i) => i.transform[4])),
        xMax: Math.max(...lineItems.map((i) => i.transform[4] + i.width)),
        yMin: Math.min(...lineItems.map((i) => i.transform[5])),
        yMax: Math.max(...lineItems.map((i) => i.transform[5] + i.height)),
      };
    })
    .filter((line) => line.text.length > 0);

  if (lineBoxes.length === 0) {
    return [];
  }

  const medianLineHeight = median(lineBoxes.map((l) => l.yMax - l.yMin)) || 1;
  const paragraphBreakGap = medianLineHeight * 1.6;

  const paragraphs: (typeof lineBoxes)[] = [];
  let currentParagraph: typeof lineBoxes = [];

  for (const line of lineBoxes) {
    const prev = currentParagraph[currentParagraph.length - 1];
    if (prev && Math.abs(prev.baseline - line.baseline) > paragraphBreakGap) {
      paragraphs.push(currentParagraph);
      currentParagraph = [];
    }
    currentParagraph.push(line);
  }
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph);
  }

  return paragraphs.map((paragraphLines) => {
    const text = paragraphLines.map((l) => l.text).join(" ");
    const xMin = Math.min(...paragraphLines.map((l) => l.xMin));
    const xMax = Math.max(...paragraphLines.map((l) => l.xMax));
    const yMin = Math.min(...paragraphLines.map((l) => l.yMin));
    const yMax = Math.max(...paragraphLines.map((l) => l.yMax));

    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([xMin, yMin, xMax, yMax]);

    return {
      text,
      x: Math.min(vx1, vx2),
      y: Math.min(vy1, vy2),
      width: Math.abs(vx2 - vx1),
      height: Math.abs(vy2 - vy1),
    };
  });
}

type TesseractBbox = { x0: number; y0: number; x1: number; y1: number };
type TesseractParagraph = { text: string; bbox: TesseractBbox };
type TesseractBlock = { paragraphs: TesseractParagraph[] };
type TesseractPageLike = { blocks: TesseractBlock[] | null };

// Tesseract already segments a recognized page into paragraphs with pixel
// bounding boxes (in the same coordinate space as the image it was given),
// so the OCR path just needs flattening into our shared shape.
export function extractOcrParagraphs(page: TesseractPageLike): ParagraphBox[] {
  if (!page.blocks) {
    return [];
  }

  return page.blocks.flatMap((block) =>
    block.paragraphs
      .filter((paragraph) => paragraph.text.trim().length > 0)
      .map((paragraph) => ({
        text: paragraph.text.trim(),
        x: paragraph.bbox.x0,
        y: paragraph.bbox.y0,
        width: paragraph.bbox.x1 - paragraph.bbox.x0,
        height: paragraph.bbox.y1 - paragraph.bbox.y0,
      })),
  );
}
