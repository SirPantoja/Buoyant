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
  10 MB), then uses [`pdf-parse`](https://www.npmjs.com/package/pdf-parse) to
  read the PDF's embedded text layer.
- If the PDF has little or no embedded text (i.e. it's a scanned document),
  the server tells the client to fall back to OCR instead. The browser then
  renders each page to a canvas with [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist)
  and reads the text off those images with [`tesseract.js`](https://www.npmjs.com/package/tesseract.js)
  (`src/lib/ocr.ts`). This runs entirely in the browser, so it needs no server
  compute and works within Vercel's serverless limits.
- Either way, the extracted text is displayed on the page once it's ready.

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

## Deployment

This app is set up to deploy on [Vercel](https://vercel.com/new). Push the
repository to GitHub and import it in Vercel, or run:

```bash
npx vercel
```
