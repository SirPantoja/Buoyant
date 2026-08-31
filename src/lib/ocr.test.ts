import { type Canvas, createCanvas } from "@napi-rs/canvas";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createWorker } from "tesseract.js";
import { describe, expect, it } from "vitest";
import { runOcrPipeline } from "./ocr";
import { extractOcrParagraphs } from "./pdf-paragraphs";

const fixturesDir = path.join(__dirname, "__fixtures__");

function createLocalWorker() {
  // Use the English training data and engine bundled as local
  // dependencies (rather than tesseract.js's default CDN fetch) so tests
  // run deterministically offline.
  return createWorker("eng", 1, {
    langPath: path.join(__dirname, "../../node_modules/@tesseract.js-data/eng/4.0.0_best_int"),
    corePath: path.join(__dirname, "../../node_modules/tesseract.js-core"),
    workerPath: path.join(__dirname, "../../node_modules/tesseract.js/src/worker-script/node/index.js"),
    cachePath: "/tmp",
    gzip: true,
  });
}

describe("runOcrPipeline", () => {
  it("renders and processes each page in order", async () => {
    const calls: string[] = [];

    const results = await runOcrPipeline(
      2,
      async (pageNumber) => {
        calls.push(`render:${pageNumber}`);
        return `canvas-${pageNumber}`;
      },
      async (canvas) => {
        calls.push(`process:${canvas}`);
        return `result for ${canvas}`;
      },
    );

    expect(results).toEqual(["result for canvas-1", "result for canvas-2"]);
    expect(calls).toEqual(["render:1", "process:canvas-1", "render:2", "process:canvas-2"]);
  });

  it("reports rendering/recognizing progress per page", async () => {
    const progress: string[] = [];

    await runOcrPipeline(
      2,
      async () => "canvas",
      async () => "result",
      (p) => progress.push(`${p.status}:${p.page}/${p.totalPages}`),
    );

    expect(progress).toEqual(["rendering:1/2", "recognizing:1/2", "rendering:2/2", "recognizing:2/2"]);
  });
});

describe("OCR against a real scanned PDF", () => {
  it("recognizes the expected text from the scanned fixture", async () => {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(path.join(fixturesDir, "scanned-book-page.pdf")));
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const worker = await createLocalWorker();

    try {
      const pageTexts = await runOcrPipeline(
        pdf.numPages,
        async (pageNumber) => {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext("2d");
          await page.render({
            canvasContext: context as unknown as CanvasRenderingContext2D,
            canvas: canvas as unknown as HTMLCanvasElement,
            viewport,
          }).promise;
          return canvas;
        },
        recognizeNodeCanvas(worker),
      );

      const text = pageTexts.join("\n\n");

      // OCR isn't pixel-perfect, so check for recognizable phrases from the
      // scanned page rather than an exact match.
      expect(text).toContain("Alice");
      expect(text).toContain("Rabbit-Hole");
      expect(text).toContain("White Rabbit");
      expect(text).toContain("waistcoat-pocket");
    } finally {
      await worker.terminate();
    }
  }, 60_000);

  it("splits the recognized page into multiple paragraphs, not one block of text", async () => {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(path.join(fixturesDir, "scanned-book-page.pdf")));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");
    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    const worker = await createLocalWorker();

    try {
      // `blocks` isn't included by default - without requesting it,
      // `data.blocks` is null and there's nothing to extract paragraphs
      // from at all, regardless of the splitting heuristic.
      const { data: result } = await worker.recognize(canvas.toBuffer("image/png"), {}, { blocks: true });
      const paragraphs = extractOcrParagraphs(
        result,
        () => ({ r: 0, g: 0, b: 0 }),
        () => ({ r: 255, g: 255, b: 255 }),
      );

      // The scanned page has a chapter heading, a subheading, and five
      // body paragraphs - Tesseract's own paragraph detection alone only
      // separates the heading from everything else, so this also checks
      // that the gap/font-size splitting actually further divides the
      // rest instead of leaving it as one block.
      expect(paragraphs.length).toBeGreaterThanOrEqual(5);

      const paragraphContaining = (phrase: string) => paragraphs.find((p) => p.text.includes(phrase));
      const rabbitHoleParagraph = paragraphContaining("Rabbit-Hole");
      const aliceParagraph = paragraphContaining("Alice was beginning");
      const waistcoatParagraph = paragraphContaining("waistcoat-pocket");

      expect(rabbitHoleParagraph).toBeDefined();
      expect(aliceParagraph).toBeDefined();
      expect(waistcoatParagraph).toBeDefined();
      // These phrases come from clearly separate paragraphs on the page,
      // so they must not have all landed in the same one.
      expect(rabbitHoleParagraph).not.toBe(aliceParagraph);
      expect(aliceParagraph).not.toBe(waistcoatParagraph);
    } finally {
      await worker.terminate();
    }
  }, 60_000);
});

function recognizeNodeCanvas(worker: Awaited<ReturnType<typeof createWorker>>) {
  return async (canvas: unknown) => {
    const buffer = (canvas as Canvas).toBuffer("image/png");
    const {
      data: { text },
    } = await worker.recognize(buffer);
    return text;
  };
}
