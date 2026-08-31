import type { RgbColor } from "./sample-color";

export type ParagraphBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  color: string;
};

// A single rendered PDF page, ready to display with clickable/hoverable
// paragraph regions overlaid on top of it.
export type RenderedPage = {
  dataUrl: string;
  width: number;
  height: number;
  paragraphs: ParagraphBox[];
};

// One line of text, already positioned in a shared top-left-origin pixel
// space (viewport pixels for an embedded text layer, canvas pixels for
// OCR), carrying the style info used both to decide where a paragraph
// should split and to render its eventual edited-text overlay.
export type StyledLine = {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  fontFamily: string;
  fontSize: number;
  color: RgbColor;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// How far apart two font sizes can be (as a ratio) before they count as
// "different". Sizes are derived from rendering/recognition data rather
// than read as an exact declared value, so this isn't 1.0.
const FONT_SIZE_CHANGE_RATIO = 1.2;

function fontSizesClose(a: number, b: number): boolean {
  const ratio = a > b ? a / b : b / a;
  return ratio <= FONT_SIZE_CHANGE_RATIO;
}

// How many median line-heights a gap needs to span before it counts as a
// paragraph break, rather than just generous line spacing within one
// paragraph. Calibrated against two real documents rather than guessed:
// on a digitally-generated multi-paragraph PDF, within-paragraph gaps
// measured ~0.3x a line's height and a genuine paragraph break ~2.0x; on a
// real scanned book page run through OCR, within-paragraph gaps measured
// up to ~0.2x and genuine paragraph breaks as low as ~1.0x. A looser value
// than that (closer to the ~2.0x seen on the clean PDF) misses most of the
// real breaks in the scanned document, so this sits roughly in the middle
// of the gap between the two documents' numbers, with comparable margin
// on both sides of it either way.
const GAP_TO_LINE_HEIGHT_RATIO = 0.6;

// Groups lines into paragraphs: a line whose font size is clearly
// different from the line before it starts a new paragraph, and so does a
// large vertical gap (loosely defined - see above), even between lines of
// the same size. So a heading immediately above body text splits on size,
// two paragraphs of the same size separated by a blank line split on gap,
// and two lines of the same size with only normal line spacing between
// them stay merged. Font family and color are still captured per line
// (below) for styling an edited paragraph's overlay text, just not used
// to split.
export function groupLinesIntoParagraphs(lines: StyledLine[]): ParagraphBox[] {
  if (lines.length === 0) {
    return [];
  }

  const medianLineHeight = median(lines.map((l) => l.yMax - l.yMin)) || 1;
  const paragraphBreakGap = medianLineHeight * GAP_TO_LINE_HEIGHT_RATIO;

  const paragraphs: StyledLine[][] = [];
  let current: StyledLine[] = [];

  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev && (line.yMin - prev.yMax > paragraphBreakGap || !fontSizesClose(prev.fontSize, line.fontSize))) {
      paragraphs.push(current);
      current = [];
    }
    current.push(line);
  }
  paragraphs.push(current);

  return paragraphs.map((linesInParagraph) => {
    const text = linesInParagraph.map((l) => l.text).join(" ");
    const xMin = Math.min(...linesInParagraph.map((l) => l.xMin));
    const xMax = Math.max(...linesInParagraph.map((l) => l.xMax));
    const yMin = Math.min(...linesInParagraph.map((l) => l.yMin));
    const yMax = Math.max(...linesInParagraph.map((l) => l.yMax));
    const { fontFamily, fontSize, color } = linesInParagraph[0];

    return {
      text,
      x: xMin,
      y: yMin,
      width: xMax - xMin,
      height: yMax - yMin,
      fontFamily,
      fontSize,
      color: `rgb(${color.r}, ${color.g}, ${color.b})`,
    };
  });
}

type TesseractBbox = { x0: number; y0: number; x1: number; y1: number };
type TesseractLine = { text: string; bbox: TesseractBbox };
type TesseractParagraph = { text: string; bbox: TesseractBbox; lines: TesseractLine[] };
type TesseractBlock = { paragraphs: TesseractParagraph[] };
type TesseractPageLike = { blocks: TesseractBlock[] | null };

type SampleColorFn = (xMin: number, xMax: number, yMin: number, yMax: number) => RgbColor;

// Tesseract's own font-family guesses per word are unreliable enough
// (frequently wrong or inconsistent between adjacent lines of the same
// font) to not be worth using even just for styling an edited paragraph's
// overlay text, so every OCR line shares this placeholder font family.
const OCR_FONT_FAMILY = "sans-serif";

function linesFromTesseractParagraph(paragraph: TesseractParagraph, sampleColor: SampleColorFn): StyledLine[] {
  return paragraph.lines
    .filter((line) => line.text.trim().length > 0)
    .map((line) => {
      const { x0, y0, x1, y1 } = line.bbox;
      return {
        text: line.text.trim(),
        xMin: x0,
        xMax: x1,
        yMin: y0,
        yMax: y1,
        fontFamily: OCR_FONT_FAMILY,
        fontSize: y1 - y0,
        color: sampleColor(x0, x1, y0, y1),
      };
    });
}

// Tesseract already segments a recognized page into paragraphs, but a
// "paragraph" there is just a block of visually close lines - it doesn't
// account for a font size change partway through, so each one is
// re-split the same way as the embedded-text-layer path (which may also
// split it further on an internal gap wider than its own line spacing).
export function extractOcrParagraphs(page: TesseractPageLike, sampleColor: SampleColorFn): ParagraphBox[] {
  if (!page.blocks) {
    return [];
  }

  return page.blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) => groupLinesIntoParagraphs(linesFromTesseractParagraph(paragraph, sampleColor))),
  );
}
