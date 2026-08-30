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
  from the paragraph/line regions Tesseract finds while recognizing the
  page (`src/lib/ocr.ts`).
- Each line also carries its font family, font size, and color, read from
  `pdfjs-dist`'s text-layer metadata for an embedded-text PDF, or estimated
  from line height for a scanned one; color comes from sampling the
  rendered page's actual pixels (`src/lib/sample-color.ts`), since neither
  source exposes fill color directly. Paragraphs split purely on font
  size: a line whose size is clearly different from the line before it
  starts a new paragraph, regardless of the gap between them or any
  color difference — so a heading immediately above body text splits into
  two, while two blocks of same-sized text separated by a blank line stay
  merged into one. Font family and color are only used to style an edited
  paragraph's overlay text (so a confirmed edit keeps looking like it
  belongs in that PDF rather than in a generic box), not to decide where
  to split.
- Clicking a paragraph opens an edit panel to the side with "Submit
  revisions" and "Undo" buttons at its top and a text box below them, where
  you describe the edit you want. Submitting sends that instruction to
  `/api/revise-paragraph` (`src/lib/revise-paragraph.ts`), which is meant to
  eventually call a real model but for now runs `generateRevision`
  (`src/lib/generate-revision.ts`) — a stand-in that waits ~2 seconds and
  always returns the fixed string `"this is an ai edit"`, so the request/
  loading/review flow is already real even though the "AI" isn't yet. While
  the request is in flight the panel shows a spinner; once a response comes
  back you choose to **Confirm** it (applies to the paragraph, styled to
  match the original), **Try again** (resends the same instructions), or
  **Try again with edits** (goes back to the text box, prefilled with what
  you typed, to revise your instructions before resending) — nothing is
  applied to the paragraph until you confirm.
- Every version of a paragraph (the original plus each *confirmed* edit) is
  kept in order in `src/lib/paragraph-edits.ts`; Undo permanently drops the
  latest entry, reverting to whatever came before it — there's no redo, so
  an undone edit is gone for good. Undo is disabled once a paragraph is
  back to its original text.
- The edit panel stays on screen as you scroll through a long PDF (it's
  `position: sticky`, capped to the viewport height with its own internal
  scroll for a long history list). This requires `html`/`body` to have
  unambiguous overflow so the browser doesn't pick the wrong scroll
  container for it — see the comment in `src/app/globals.css` for the
  overflow-axis quirk that broke this at first.

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
- `pdf-paragraphs.test.ts` checks the paragraph-splitting heuristic: lines
  with the same font size merge into one paragraph even across a large
  gap; a font size change alone starts a new paragraph even with no extra
  gap; a font family or color change alone does not cause a split; and
  font-size noise within tolerance doesn't cause a false split. Also
  checks that Tesseract's paragraph/line blocks are flattened and
  re-split the same way for the OCR path.
- `sample-color.test.ts` checks that the pixel-sampling color reader finds
  ink wherever it is in a line's box, using a fake canvas context — it
  doesn't just check one row of pixels, since a real glyph's ink might not
  cross the exact vertical center sampled.
- `paragraph-edits.test.ts` checks the per-paragraph edit history: it seeds
  one history per paragraph with the original text, appends new edits
  immutably, reports the current (latest) text for a paragraph, and checks
  that undo permanently drops the latest edit while being a no-op once a
  paragraph is back to its original text.
- `generate-revision.test.ts` checks the dummy AI stand-in resolves with its
  fixed response only after the simulated delay (using fake timers, so the
  test doesn't actually wait).
- `revise-paragraph.test.ts` checks the client-side request helper posts
  the current text and instructions to `/api/revise-paragraph` and returns
  the result, and that it surfaces the server's error message on failure.

## Deployment

This app is set up to deploy on [Vercel](https://vercel.com/new). Push the
repository to GitHub and import it in Vercel, or run:

```bash
npx vercel
```
