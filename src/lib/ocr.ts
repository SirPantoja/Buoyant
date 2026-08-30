export type OcrProgress = {
  page: number;
  totalPages: number;
  status: "rendering" | "recognizing";
};

// Renders one page (1-indexed) to whatever canvas-like object the
// environment uses (an HTMLCanvasElement in the browser, a node-canvas
// Canvas in tests), then reads text off it. Kept environment-agnostic so
// the same page-by-page orchestration can run in the browser and in tests.
export type PageRenderer = (pageNumber: number) => Promise<unknown>;
export type PageRecognizer = (canvas: unknown) => Promise<string>;

export async function runOcrPipeline(
  totalPages: number,
  renderPage: PageRenderer,
  recognizePage: PageRecognizer,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    onProgress?.({ page: pageNumber, totalPages, status: "rendering" });
    const canvas = await renderPage(pageNumber);

    onProgress?.({ page: pageNumber, totalPages, status: "recognizing" });
    const text = await recognizePage(canvas);
    pageTexts.push(text.trim());
  }

  return pageTexts.join("\n\n").trim();
}

export async function extractTextWithOcr(
  file: File,
  onProgress?: (progress: OcrProgress) => void,
): Promise<string> {
  const [pdfjsLib, tesseract] = await Promise.all([import("pdfjs-dist"), import("tesseract.js")]);

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const worker = await tesseract.createWorker("eng");

  try {
    return await runOcrPipeline(
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
        const {
          data: { text },
        } = await worker.recognize(canvas as HTMLCanvasElement);
        return text;
      },
      onProgress,
    );
  } finally {
    await worker.terminate();
  }
}
