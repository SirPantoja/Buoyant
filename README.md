# Buoyant

A Next.js + TypeScript app for uploading a PDF and reading the text out of it.

## Running locally

**Prerequisites:** [Node.js](https://nodejs.org/) 20 or later and npm.

1. Clone the repository and move into it:
   ```bash
   git clone https://github.com/SirPantoja/Buoyant.git
   cd Buoyant
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser and upload a PDF.

Other useful scripts:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # lint the codebase
npm test        # run the test suite
```

## How it works

- `src/app/page.tsx` renders a file picker restricted to PDFs and posts the
  selected file to `/api/upload`.
- `src/app/api/upload/route.ts` validates the upload (must be a PDF, up to
  50 MB), then uses [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) to
  read the PDF's embedded text layer.
- If the PDF has little or no embedded text (i.e. it's a scanned document),
  the server tells the client to fall back to OCR instead. The browser then
  renders each page to a canvas with [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist)
  and reads the text off those images with [`tesseract.js`](https://www.npmjs.com/package/tesseract.js)
  (`src/lib/ocr.ts`). This runs entirely in the browser, so it needs no server
  compute and works within Vercel's serverless limits.
- Either way, the extracted text is displayed on the page once it's ready.
- The browser also renders every page of the PDF as an image and overlays a
  box around each paragraph (`src/lib/pdf-paragraphs.ts`), so hovering over
  a paragraph on the page highlights it. For a PDF with an embedded text
  layer, the boxes come from grouping `pdfjs-dist`'s per-line text
  positions (`src/lib/render-pdf-pages.ts`); for a scanned PDF, they come
  directly from the paragraph regions Tesseract finds while recognizing the
  page (`src/lib/ocr.ts`).
- Clicking a paragraph opens an edit panel to the side with a text box and a
  "What are your edits?" button. Submitting replaces that paragraph's
  display with the text you typed. Every version of a paragraph (the
  original plus each edit) is kept in order in `src/lib/paragraph-edits.ts`,
  so a future "undo" only needs to pop the latest entry off a paragraph's
  history — there's no undo button yet, just the history to support one.

Note: OCR downloads its recognition engine and language data from a CDN the
first time it runs in a given browser, so it requires normal internet access
on the client.

## Testing

`npm test` runs the [Vitest](https://vitest.dev) suite in `src/lib/`:

- `extract-pdf-text.test.ts` checks that `pdf-parse` reads the expected text
  from a digital PDF and correctly flags a scanned one as needing OCR.
- `ocr.test.ts` checks the page-by-page OCR orchestration logic, and runs a
  real (non-mocked) OCR pass over a scanned fixture page, asserting the
  recognized text contains the expected phrases. It uses the
  [`@tesseract.js-data/eng`](https://www.npmjs.com/package/@tesseract.js-data/eng)
  package for the language data so the test runs offline and
  deterministically instead of depending on `tesseract.js`'s default CDN
  fetch.
- `pdf-paragraphs.test.ts` checks the paragraph-detection heuristics: that
  text items sharing a line and nearby lines are grouped into one
  paragraph, that a large vertical gap starts a new one, and that
  Tesseract's own paragraph blocks are flattened correctly for the OCR
  path.
- `paragraph-edits.test.ts` checks the per-paragraph edit history: it seeds
  one history per paragraph with the original text, appends new edits
  immutably, and reports the current (latest) text for a paragraph.

## Deployment

This app is set up to deploy on [Vercel](https://vercel.com/new). Push the
repository to GitHub and import it in Vercel, or run:

```bash
npx vercel
```
