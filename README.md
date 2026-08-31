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
  compute and works within Vercel's serverless limits. `worker.recognize`
  must be called with `{ blocks: true }` or Tesseract's result omits the
  block/paragraph/line structure entirely (`data.blocks` comes back `null`),
  which the paragraph-box feature below depends on.
- Either way, the extracted text is displayed on the page once it's ready.
- The browser also renders every page of the PDF as an image and overlays a
  box around each paragraph (`src/lib/pdf-paragraphs.ts`), so hovering over
  a paragraph on the page highlights it. For a PDF with an embedded text
  layer, the boxes come from grouping `pdfjs-dist`'s per-line text
  positions (`src/lib/render-pdf-pages.ts`); for a scanned PDF, they come
  from the paragraph/line regions Tesseract finds while recognizing the
  page (`src/lib/ocr.ts`).
- Each line also carries its font family, font size, color, and background
  color, read from `pdfjs-dist`'s text-layer metadata for an embedded-text
  PDF, or estimated from line height for a scanned one; color and
  background color both come from sampling the rendered page's actual
  pixels (`src/lib/sample-color.ts`) — the darkest sampled point in the
  line's box for the ink, the lightest for the page behind it — since
  neither source exposes either directly. The background sample is what
  lets a confirmed edit's overlay sit on the same background as the
  original text (a colored callout box, a tinted page, etc.) instead of a
  plain highlight color; an edited paragraph also has no visible border
  of its own, so once you click away it looks like an ordinary part of
  the page rather than staying permanently boxed - the accent-colored
  border only ever shows on hover or while it's the one currently
  selected for editing, same as any other paragraph. Paragraphs split on
  any of three
  signals: a line whose font size is clearly different from the line
  before it (a heading immediately above body text), a vertical gap
  before it that's clearly wider than normal line spacing (a blank line
  between two paragraphs of the same size), or a clear color change (a
  callout or highlighted line in the middle of otherwise same-sized,
  normally-spaced text) — a font family change alone does not split. The
  gap threshold (`GAP_TO_LINE_HEIGHT_RATIO` in `src/lib/pdf-paragraphs.ts`)
  is calibrated against two real documents rather than guessed: a
  digitally-generated multi-paragraph PDF, where within-paragraph gaps
  measured well under the threshold and a genuine break well over it, and
  a real scanned book page run through OCR, where genuine paragraph
  breaks measured as low as ~1.0x a line's height, much tighter than the
  clean PDF's. The chosen value sits with margin on both sides of both
  documents' numbers, favoring the tighter document since a looser value
  misses most of its real breaks. The color threshold
  (`COLOR_DISTANCE_THRESHOLD`) is a Euclidean RGB distance generous enough
  to absorb sampling noise between lines of the same intended color (e.g.
  JPEG artifacts or anti-aliasing shifting a scanned page's black text
  toward gray), but still far tighter than the distance between genuinely
  different colors like black and red. Font family is only used to style
  an edited paragraph's overlay text (so a confirmed edit keeps looking
  like it belongs in that PDF rather than in a generic box), not to
  decide where to split.
- Clicking a paragraph opens an edit panel to the side with "Submit
  revisions" and "Undo" buttons at its top and a text box below them, where
  you describe the edit you want. Submitting sends that instruction to
  `/api/revise-paragraph` (`src/lib/revise-paragraph.ts`), which is meant to
  eventually call a real model but for now runs `generateRevision`
  (`src/lib/generate-revision.ts`) — a stand-in that waits ~2 seconds and
  always returns the fixed string `"this is an ai edit"`, so the request/
  loading/review flow is already real even though the "AI" isn't yet. While
  the request is in flight the panel shows a spinner; once a response comes
  back you choose to **Confirm** it (applies to the paragraph, styled and
  set on the same background as the original), **Try again** (resends the
  same instructions), or
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
  fetch. A second real-data test recognizes that same scanned page with
  `{ blocks: true }` and checks that the paragraph-splitting logic actually
  recovers its chapter heading, subheading, and separate body paragraphs
  as distinct paragraphs rather than one block of text — Tesseract's own
  paragraph grouping alone isn't enough to do that on this page.
- `pdf-paragraphs.test.ts` checks the paragraph-splitting heuristic: lines
  with a normal gap, the same font size, and the same color merge into
  one paragraph; a gap as small as the smallest real paragraph break
  measured on the scanned fixture still splits, as does a clearly wider
  gap; a font size change alone starts a new paragraph even with no extra
  gap; a color change alone does too; a font family change alone does
  not cause a split; and font-size or color-sampling noise within
  tolerance doesn't cause a false split. Also checks that the sampled
  background color is carried onto a resulting paragraph independently of
  the ink color, and that Tesseract's paragraph/line blocks are flattened
  and re-split the same way for the OCR path.
- `sample-color.test.ts` checks that the pixel-sampling color reader finds
  ink (the darkest sampled point) and background (the lightest) wherever
  they are in a line's box, using a fake canvas context — it doesn't just
  check one row of pixels, since a real glyph's ink, or a gap of
  background between glyphs, might not cross the exact vertical center
  sampled.
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
