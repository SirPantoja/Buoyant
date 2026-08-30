export type RgbColor = { r: number; g: number; b: number };

type CanvasContextLike = {
  getImageData(sx: number, sy: number, sw: number, sh: number): { data: ArrayLike<number> };
};

const MAX_SAMPLES_PER_AXIS = 8;
const SAMPLE_SPACING_PX = 4;

// Neither a PDF's text layer nor Tesseract's OCR output exposes the text's
// actual fill color, so this reads it directly off the rendered page
// instead. It scans a grid of points across the line's box and keeps the
// darkest one, on the assumption that ink is darker than the page
// background behind it - true for the overwhelming majority of documents,
// though it would misfire on light text over a dark page. A single row of
// samples isn't reliable enough: depending on a glyph's shape, an entire
// row can land only on anti-aliased edges or gaps between letters and miss
// solid ink completely, so this checks multiple rows too.
export function sampleTextColor(
  context: CanvasContextLike,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
): RgbColor {
  const width = xMax - xMin;
  const height = yMax - yMin;

  const xSteps = Math.max(1, Math.min(MAX_SAMPLES_PER_AXIS, Math.round(width / SAMPLE_SPACING_PX)));
  const ySteps = Math.max(1, Math.min(MAX_SAMPLES_PER_AXIS, Math.round(height / SAMPLE_SPACING_PX)));

  let darkest: (RgbColor & { luminance: number }) | null = null;

  for (let xi = 1; xi <= xSteps; xi++) {
    const x = Math.round(xMin + (width * xi) / (xSteps + 1));

    for (let yi = 1; yi <= ySteps; yi++) {
      const y = Math.round(yMin + (height * yi) / (ySteps + 1));
      const { data } = context.getImageData(x, y, 1, 1);
      const [r, g, b] = [data[0], data[1], data[2]];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      if (!darkest || luminance < darkest.luminance) {
        darkest = { r, g, b, luminance };
      }
    }
  }

  return darkest ? { r: darkest.r, g: darkest.g, b: darkest.b } : { r: 0, g: 0, b: 0 };
}
