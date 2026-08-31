export const MIN_EMBEDDED_TEXT_LENGTH = 20;

export type EmbeddedTextResult = { source: "embedded"; text: string } | { source: "ocr-required"; text: null };

type TextContentLike = { items: unknown[] };
type PdfPageLike = { getTextContent(): Promise<TextContentLike> };
export type PdfDocumentLike = { numPages: number; getPage(pageNumber: number): Promise<PdfPageLike> };

// A PDF with little to no embedded text is likely a scan/image, so it needs
// OCR instead of the text layer this function just tried to read. Runs
// against an already-open pdf.js document - either from `pdfjs-dist` in the
// browser (see detectEmbeddedTextInFile below) or its Node-compatible
// `legacy` build in tests - rather than a file, so a caller already holding
// one document can reuse it.
export async function detectEmbeddedText(pdf: PdfDocumentLike): Promise<EmbeddedTextResult> {
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter((item): item is { str: string } => typeof (item as { str?: unknown }).str === "string");
    pageTexts.push(items.map((item) => item.str).join(""));
  }

  const text = pageTexts.join("\n\n").trim();

  if (text.length < MIN_EMBEDDED_TEXT_LENGTH) {
    return { source: "ocr-required", text: null };
  }

  return { source: "embedded", text };
}

// Runs the check above entirely in the browser via `pdfjs-dist`, rather
// than posting the file to a server route: a server route means the whole
// file has to fit in one HTTP request body, and Vercel's Serverless
// Functions reject anything over ~4.5 MB at the platform level before the
// route even runs. Reading the text layer client-side instead has no such
// ceiling - it's bounded only by the browser's own memory, same as the
// page-rendering and OCR paths that already run client-side.
export async function detectEmbeddedTextInFile(file: File): Promise<EmbeddedTextResult> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  return detectEmbeddedText(pdf);
}
