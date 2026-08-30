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
// "different". Pixel-derived sizes vary slightly line to line even within
// one run of text, so this isn't 1.0.
const FONT_SIZE_CHANGE_RATIO = 1.2;

// How far apart two sampled colors can be (Euclidean RGB distance) before
// they count as "different". Sampling real pixels means anti-aliasing and
// compression noise can shift the same visual color by a few units between
// lines, so this isn't 0.
const COLOR_DISTANCE_THRESHOLD = 60;

function colorsClose(a: RgbColor, b: RgbColor): boolean {
  const distance = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
  return distance <= COLOR_DISTANCE_THRESHOLD;
}

function sameStyle(a: StyledLine, b: StyledLine): boolean {
  if (a.fontFamily !== b.fontFamily) {
    return false;
  }
  if (!colorsClose(a.color, b.color)) {
    return false;
  }
  const ratio = a.fontSize > b.fontSize ? a.fontSize / b.fontSize : b.fontSize / a.fontSize;
  return ratio <= FONT_SIZE_CHANGE_RATIO;
}

// Groups lines into paragraphs: a large vertical gap OR a change in font
// family, size, or color starts a new paragraph, so a visually distinct
// run of text (a heading before body text, a bolded aside, a colored
// callout) becomes its own hoverable/editable region even when it isn't
// separated by extra whitespace. Neither a PDF's text layer nor Tesseract
// marks "paragraph" boundaries explicitly, so this is a heuristic.
export function groupLinesIntoParagraphs(lines: StyledLine[]): ParagraphBox[] {
  if (lines.length === 0) {
    return [];
  }

  const medianLineHeight = median(lines.map((l) => l.yMax - l.yMin)) || 1;
  const paragraphBreakGap = medianLineHeight * 0.8;

  const paragraphs: StyledLine[][] = [];
  let current: StyledLine[] = [];

  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev && (line.yMin - prev.yMax > paragraphBreakGap || !sameStyle(prev, line))) {
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
// font) that splitting on them would fragment paragraphs that are
// visually uniform, so every OCR line shares this placeholder font family
// and only its size and sampled color drive splitting.
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
// account for a font/size/color change partway through, so each one is
// re-split the same way as the embedded-text-layer path.
export function extractOcrParagraphs(page: TesseractPageLike, sampleColor: SampleColorFn): ParagraphBox[] {
  if (!page.blocks) {
    return [];
  }

  return page.blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) => groupLinesIntoParagraphs(linesFromTesseractParagraph(paragraph, sampleColor))),
  );
}
