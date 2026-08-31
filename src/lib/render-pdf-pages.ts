import { groupLinesIntoParagraphs, type RenderedPage, type StyledLine } from "./pdf-paragraphs";
import { sampleTextColor } from "./sample-color";

const RENDER_SCALE = 2;

type TextItemLike = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL: boolean;
  fontName: string;
};

type ViewportLike = {
  convertToViewportRectangle(rect: number[]): number[];
  scale: number;
};

type CanvasContextLike = Parameters<typeof sampleTextColor>[0];

// pdf.js marks a line break with a trailing empty-string item whose own
// position belongs to the *next* line, so it must not contribute to this
// line's geometry - only real text does.
function groupItemsIntoLines(items: TextItemLike[]): TextItemLike[][] {
  const lines: TextItemLike[][] = [];
  let current: TextItemLike[] = [];

  for (const item of items) {
    if (item.str.length > 0) {
      current.push(item);
    }
    if (item.hasEOL && current.length > 0) {
      lines.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function buildStyledLines(
  items: TextItemLike[],
  styles: Record<string, { fontFamily: string }>,
  viewport: ViewportLike,
  context: CanvasContextLike,
): StyledLine[] {
  return groupItemsIntoLines(items).map((lineItems) => {
    const text = lineItems
      .map((i) => i.str)
      .join("")
      .trim();

    const xMinPdf = Math.min(...lineItems.map((i) => i.transform[4]));
    const xMaxPdf = Math.max(...lineItems.map((i) => i.transform[4] + i.width));
    const yMinPdf = Math.min(...lineItems.map((i) => i.transform[5]));
    const yMaxPdf = Math.max(...lineItems.map((i) => i.transform[5] + i.height));

    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([xMinPdf, yMinPdf, xMaxPdf, yMaxPdf]);
    const xMin = Math.min(vx1, vx2);
    const xMax = Math.max(vx1, vx2);
    const yMin = Math.min(vy1, vy2);
    const yMax = Math.max(vy1, vy2);

    const firstItem = lineItems[0];
    // The font size magnitude of a (possibly rotated/skewed) text matrix is
    // the length of its second column vector; multiplying by the viewport
    // scale converts it from PDF units to the same pixel space as x/y here.
    const fontSize = Math.hypot(firstItem.transform[2], firstItem.transform[3]) * viewport.scale;

    return {
      text,
      xMin,
      xMax,
      yMin,
      yMax,
      fontFamily: styles[firstItem.fontName]?.fontFamily ?? "sans-serif",
      fontSize,
      color: sampleTextColor(context, xMin, xMax, yMin, yMax),
    };
  });
}

// Renders every page of a PDF that has a real text layer, pairing each
// page's image with the paragraph regions read from that text layer, for
// the interactive viewer.
export async function renderEmbeddedPdfPages(file: File): Promise<RenderedPage[]> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: RenderedPage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create a canvas context for rendering.");
    }
    await page.render({ canvasContext: context, canvas, viewport }).promise;

    const textContent = await page.getTextContent();
    const items = textContent.items.filter(
      (item): item is Extract<(typeof textContent.items)[number], { str: string }> => "str" in item,
    );
    const lines = buildStyledLines(items, textContent.styles, viewport, context);
    const paragraphs = groupLinesIntoParagraphs(lines);

    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      paragraphs,
    });
  }

  return pages;
}
