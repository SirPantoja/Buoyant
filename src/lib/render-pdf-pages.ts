import { groupTextItemsIntoParagraphs, type RenderedPage } from "./pdf-paragraphs";

const RENDER_SCALE = 2;

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
    const paragraphs = groupTextItemsIntoParagraphs(items, viewport);

    pages.push({
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
      paragraphs,
    });
  }

  return pages;
}
