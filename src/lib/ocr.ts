export type OcrProgress = {
  page: number;
  totalPages: number;
  status: "rendering" | "recognizing";
};

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
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      onProgress?.({ page: pageNumber, totalPages: pdf.numPages, status: "rendering" });

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

      onProgress?.({ page: pageNumber, totalPages: pdf.numPages, status: "recognizing" });

      const {
        data: { text },
      } = await worker.recognize(canvas);
      pageTexts.push(text.trim());
    }

    return pageTexts.join("\n\n").trim();
  } finally {
    await worker.terminate();
  }
}
