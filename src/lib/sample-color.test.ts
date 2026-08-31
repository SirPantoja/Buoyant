import { describe, expect, it } from "vitest";
import { sampleBackgroundColor, sampleTextColor } from "./sample-color";

// A fake canvas context whose pixels are defined by a lookup function of x,
// so tests can place "ink" at specific x positions without a real canvas.
function fakeContext(pixelAt: (x: number) => [number, number, number]) {
  return {
    getImageData(x: number) {
      const [r, g, b] = pixelAt(x);
      return { data: [r, g, b, 255] };
    },
  };
}

describe("sampleTextColor", () => {
  it("picks the darkest sampled point, treating it as the ink color", () => {
    // White background everywhere except a dark patch through the middle.
    const context = fakeContext((x) => (x >= 40 && x <= 60 ? [20, 30, 200] : [255, 255, 255]));

    const color = sampleTextColor(context, 0, 100, 0, 10);

    expect(color).toEqual({ r: 20, g: 30, b: 200 });
  });

  it("finds ink even when it only occupies part of the sampled rows", () => {
    // Ink only at one specific y - a single-row scan could easily miss it.
    const context = fakeContext(() => [255, 255, 255]);
    const gridContext = {
      getImageData(x: number, y: number) {
        if (y === 3 && x >= 40 && x <= 60) {
          return { data: [10, 10, 10, 255] };
        }
        return context.getImageData(x);
      },
    };

    const color = sampleTextColor(gridContext, 0, 100, 0, 20);

    expect(color).toEqual({ r: 10, g: 10, b: 10 });
  });

  it("returns white when every sampled point is white (no ink found)", () => {
    const context = fakeContext(() => [255, 255, 255]);

    const color = sampleTextColor(context, 0, 100, 0, 10);

    expect(color).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("sampleBackgroundColor", () => {
  it("picks the lightest sampled point, treating it as the page background", () => {
    // Cream-colored page everywhere except a dark patch of ink through the middle.
    const context = fakeContext((x) => (x >= 40 && x <= 60 ? [20, 30, 40] : [250, 245, 230]));

    const color = sampleBackgroundColor(context, 0, 100, 0, 10);

    expect(color).toEqual({ r: 250, g: 245, b: 230 });
  });

  it("finds the background even when it only occupies part of the sampled rows", () => {
    // Background only peeks through at one specific y - a single-row scan could easily miss it.
    const context = fakeContext(() => [10, 10, 10]);
    const gridContext = {
      getImageData(x: number, y: number) {
        if (y === 3 && x >= 40 && x <= 60) {
          return { data: [240, 240, 240, 255] };
        }
        return context.getImageData(x);
      },
    };

    const color = sampleBackgroundColor(gridContext, 0, 100, 0, 20);

    expect(color).toEqual({ r: 240, g: 240, b: 240 });
  });

  it("returns black when every sampled point is black (no background found)", () => {
    const context = fakeContext(() => [0, 0, 0]);

    const color = sampleBackgroundColor(context, 0, 100, 0, 10);

    expect(color).toEqual({ r: 0, g: 0, b: 0 });
  });
});
