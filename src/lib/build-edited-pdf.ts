import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getCurrentText, hasEdits, paragraphKey, type ParagraphEditState } from "./paragraph-edits";
import type { ParagraphBox, RenderedPage } from "./pdf-paragraphs";

const PADDING = 2;

// Parses the `rgb(r, g, b)` strings pdf-paragraphs.ts produces into
// pdf-lib's 0-1 float color format.
function parseRgb(value: string): { r: number; g: number; b: number } {
  const match = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) {
    return { r: 0, g: 0, b: 0 };
  }
  const [, r, g, b] = match;
  return { r: Number(r) / 255, g: Number(g) / 255, b: Number(b) / 255 };
}

// A plain word-wrap pass just to estimate how many lines the replacement
// text will need - not to lay it out (pdf-lib's own `maxWidth` option on
// drawText does the real wrapping) - so the background rectangle can be
// sized tall enough to hold it upfront, the same way the live web preview
// grows an edited paragraph's box to fit a longer replacement.
function estimateLineCount(font: PDFFont, text: string, fontSize: number, maxWidth: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  if (maxWidth <= 0 || words.length === 0) {
    return 1;
  }

  const spaceWidth = font.widthOfTextAtSize(" ", fontSize);
  let lines = 1;
  let lineWidth = 0;

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(word, fontSize);
    const widthWithWord = lineWidth === 0 ? wordWidth : lineWidth + spaceWidth + wordWidth;
    if (widthWithWord > maxWidth && lineWidth > 0) {
      lines += 1;
      lineWidth = wordWidth;
    } else {
      lineWidth = widthWithWord;
    }
  }

  return lines;
}

// Draws one edited paragraph over its original position: a filled
// rectangle (the sampled background, so it blends the same way the web
// preview's overlay does) followed by the replacement text. `scaleX`/
// `scaleY` convert from the rendered page's canvas-pixel space (top-left
// origin) into the original PDF page's own point space (bottom-left
// origin, `pdfPageHeight` tall).
function drawEditedParagraph(
  pdfPage: PDFPage,
  font: PDFFont,
  paragraph: ParagraphBox,
  text: string,
  scaleX: number,
  scaleY: number,
  pdfPageHeight: number,
): void {
  const boxX = paragraph.x * scaleX;
  const boxWidth = paragraph.width * scaleX;
  const boxTopFromPageTop = paragraph.y * scaleY;
  const originalBoxHeight = paragraph.height * scaleY;
  const fontSize = Math.max(6, paragraph.fontSize * scaleY);
  const lineHeight = fontSize * 1.3;

  const lineCount = estimateLineCount(font, text, fontSize, boxWidth - PADDING * 2);
  const neededHeight = lineCount * lineHeight + PADDING * 2;
  const boxHeight = Math.max(originalBoxHeight, neededHeight);

  const boxY = pdfPageHeight - boxTopFromPageTop - boxHeight;
  const background = parseRgb(paragraph.backgroundColor);

  pdfPage.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    color: rgb(background.r, background.g, background.b),
  });

  const textColor = parseRgb(paragraph.color);
  pdfPage.drawText(text, {
    x: boxX + PADDING,
    y: boxY + boxHeight - fontSize - PADDING,
    size: fontSize,
    font,
    color: rgb(textColor.r, textColor.g, textColor.b),
    maxWidth: boxWidth - PADDING * 2,
    lineHeight,
  });
}

// Rebuilds the original PDF with each edited paragraph's text drawn over
// its original position, rather than rendering a fresh PDF from the page
// images: reusing the original file keeps the output close to its
// original size (no re-embedded page screenshots), and any page whose
// paragraphs weren't touched comes through completely unchanged. Font
// family isn't preserved (pdf-lib would need the original font file
// embedded, which the browser doesn't have access to) - every edit is
// drawn in Helvetica, matching only the original's size and color.
export async function buildEditedPdf(
  originalFile: File,
  pages: RenderedPage[],
  editState: ParagraphEditState,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await originalFile.arrayBuffer());
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pdfPages = doc.getPages();

  pages.forEach((page, pageIndex) => {
    const pdfPage = pdfPages[pageIndex];
    if (!pdfPage) {
      return;
    }

    const { width: pdfWidth, height: pdfHeight } = pdfPage.getSize();
    const scaleX = pdfWidth / page.width;
    const scaleY = pdfHeight / page.height;

    page.paragraphs.forEach((paragraph, paragraphIndex) => {
      const key = paragraphKey(pageIndex, paragraphIndex);
      if (!hasEdits(editState, key)) {
        return;
      }

      const text = getCurrentText(editState, key) ?? paragraph.text;
      drawEditedParagraph(pdfPage, font, paragraph, text, scaleX, scaleY, pdfHeight);
    });
  });

  return doc.save();
}
