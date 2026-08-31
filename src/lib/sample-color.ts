export type RgbColor = { r: number; g: number; b: number };

type CanvasContextLike = {
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: ArrayLike<number> };
};

const MAX_SAMPLES_PER_AXIS = 8;
const SAMPLE_SPACING_PX = 4;

// Shared by sampleTextColor and sampleBackgroundColor: scans a grid of
// points across the box and keeps whichever end of the luminance range
// (darkest or lightest) is being looked for. A single row of samples
// isn't reliable enough for either - depending on a glyph's shape, an
// entire row can land only on anti-aliased edges or gaps between letters
// and miss the thing being looked for completely, so this checks
// multiple rows too.
function sampleExtremeColor(
  context: CanvasContextLike,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  keepDarker: boolean,
): RgbColor {
  const width = xMax - xMin;
  const height = yMax - yMin;

  const xSteps = Math.max(1, Math.min(MAX_SAMPLES_PER_AXIS, Math.round(width / SAMPLE_SPACING_PX)));
  const ySteps = Math.max(1, Math.min(MAX_SAMPLES_PER_AXIS, Math.round(height / SAMPLE_SPACING_PX)));

  let best: (RgbColor & { luminance: number }) | null = null;

  for (let xi = 1; xi <= xSteps; xi++) {
    const x = Math.round(xMin + (width * xi) / (xSteps + 1));

    for (let yi = 1; yi <= ySteps; yi++) {
      const y = Math.round(yMin + (height * yi) / (ySteps + 1));
      const { data } = context.getImageData(x, y, 1, 1);
      const [r, g, b] = [data[0], data[1], data[2]];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (!best || (keepDarker ? luminance < best.luminance : luminance > best.luminance)) {
        best = { r, g, b, luminance };
      }
    }
  }

  if (best) {
    return { r: best.r, g: best.g, b: best.b };
  }
  const fallback = keepDarker ? 0 : 255;
  return { r: fallback, g: fallback, b: fallback };
}

// Neither a PDF's text layer nor Tesseract's OCR output exposes the text's
// actual fill color, so this reads it directly off the rendered page
// instead. It keeps the darkest sampled point, on the assumption that ink
// is darker than the page background behind it - true for the
// overwhelming majority of documents, though it would misfire on light
// text over a dark page.
export function sampleTextColor(
  context: CanvasContextLike,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): RgbColor {
  return sampleExtremeColor(context, xMin, xMax, yMin, yMax, true);
}

// The complement of sampleTextColor: keeps the lightest sampled point
// instead of the darkest, under the same ink-is-darker-than-background
// assumption, so it recovers the paper/background color showing through
// the gaps between and around glyphs within the same box. Used to give an
// edited paragraph's overlay the same background it's sitting on, so it
// blends into the page instead of sitting in a plain highlight box.
export function sampleBackgroundColor(
  context: CanvasContextLike,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): RgbColor {
  return sampleExtremeColor(context, xMin, xMax, yMin, yMax, false);
}
