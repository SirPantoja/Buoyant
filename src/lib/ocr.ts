import { extractOcrParagraphs, type RenderedPage } from "./pdf-paragraphs";
import { sampleTextColor } from "./sample-color";

export type OcrProgress = {
  page: number;
  totalPages: number;
  status: "rendering" | "recognizing";
};

// Renders one page (1-indexed) to whatever canvas-like object the
// environment uses (an HTMLCanvasElement in the browser, a node-canvas
// Canvas in tests), then turns it into a result. Kept environment-agnostic
// so the same page-by-page orchestration can run in the browser and in
// tests.
export type PageRenderer = (pageNumber: number) => Promise<unknown>;
export type PageProcessor<T> = (canvas: unknown) => Promise<T>;

export async function runOcrPipeline<T>(
  totalPages: number,
  renderPage: PageRenderer,
  processPage: PageProcessor<T>,
  onProgress?: (progress: OcrProgress) => void,
): Promise<T[]> {
  const results: T[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    onProgress?.({ page: pageNumber, totalPages, status: "rendering" });
    const canvas = await renderPage(pageNumber);

    onProgress?.({ page: pageNumber, totalPages, status: "recognizing" });
    const result = await processPage(canvas);
    results.push(result);
  }

  return results;
}

// Renders each page of a scanned PDF to a canvas and runs OCR over it,
// returning both the plain extracted text and, per page, the image plus
// the paragraph regions Tesseract found on it (for the interactive viewer).
export async function renderPdfWithOcr(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<{ text: string; pages: RenderedPage[] }> {
  const [pdfjsLib, tesseract] = await Promise.all([import("pdfjs-dist"), import("tesseract.js")]);

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const worker = await tesseract.createWorker("eng");

  try {
    const pages = await runOcrPipeline(
      pdf.numPages,
      async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Could not create a canvas context for OCR.");
        }

        await page.render({ canvasContext: context, canvas, viewport }).promise;
        return canvas;
      },
      async (canvas) => {
        const htmlCanvas = canvas as HTMLCanvasElement;
        const { data } = await worker.recognize(htmlCanvas);
        const context = htmlCanvas.getContext("2d");
        if (!context) {
          throw new Error("Could not create a canvas context for OCR.");
        }

        return {
          text: data.text.trim(),
          dataUrl: htmlCanvas.toDataURL("image/png"),
          width: htmlCanvas.width,
          height: htmlCanvas.height,
          paragraphs: extractOcrParagraphs(data, (xMin, xMax, yMin, yMax) =>
            sampleTextColor(context, xMin, xMax, yMin, yMax),
          ),
        };
      },
      onProgress,
    );

    return {
      text: pages
        .map((p) => p.text)
        .join("\n\n")
        .trim(),
      pages: pages.map(({ dataUrl, width, height, paragraphs }) => ({ dataUrl, width, height, paragraphs })),
    };
  } finally {
    await worker.terminate();
  }
}
