import { describe, expect, it } from "vitest";
import {
  addEdit,
  buildInitialEditState,
  getCurrentText,
  hasEdits,
  paragraphKey,
  undoEdit,
} from "./paragraph-edits";
import type { RenderedPage } from "./pdf-paragraphs";

function page(paragraphTexts: string[]): RenderedPage {
  return {
    dataUrl: "data:image/png;base64,",
    width: 100,
    height: 100,
    paragraphs: paragraphTexts.map((text) => ({ text, x: 0, y: 0, width: 10, height: 10 })),
  };
}

describe("buildInitialEditState", () => {
  it("seeds one-entry history per paragraph, keyed by page and paragraph index", () => {
    const pages = [page(["First", "Second"]), page(["Third"])];

    const state = buildInitialEditState(pages);

    expect(state).toEqual({
      "0:0": ["First"],
      "0:1": ["Second"],
      "1:0": ["Third"],
    });
  });
});

describe("addEdit / getCurrentText / hasEdits", () => {
  it("appends edits without mutating the previous state, and tracks the current text", () => {
    const initial = buildInitialEditState([page(["Original text"])]);
    const key = paragraphKey(0, 0);

    const afterOneEdit = addEdit(initial, key, "First edit");

    expect(initial[key]).toEqual(["Original text"]);
    expect(afterOneEdit[key]).toEqual(["Original text", "First edit"]);
    expect(getCurrentText(afterOneEdit, key)).toBe("First edit");
    expect(hasEdits(initial, key)).toBe(false);
    expect(hasEdits(afterOneEdit, key)).toBe(true);

    const afterTwoEdits = addEdit(afterOneEdit, key, "Second edit");
    expect(afterTwoEdits[key]).toEqual(["Original text", "First edit", "Second edit"]);
    expect(getCurrentText(afterTwoEdits, key)).toBe("Second edit");
  });

  it("returns undefined for a paragraph key that was never initialized", () => {
    expect(getCurrentText({}, paragraphKey(0, 0))).toBeUndefined();
    expect(hasEdits({}, paragraphKey(0, 0))).toBe(false);
  });
});

describe("undoEdit", () => {
  it("permanently drops the latest edit, falling back to the previous version", () => {
    const key = paragraphKey(0, 0);
    let state = buildInitialEditState([page(["Original"])]);
    state = addEdit(state, key, "Edit 1");
    state = addEdit(state, key, "Edit 2");

    const afterUndo = undoEdit(state, key);
    expect(afterUndo[key]).toEqual(["Original", "Edit 1"]);
    // The undone state doesn't mutate what came before it.
    expect(state[key]).toEqual(["Original", "Edit 1", "Edit 2"]);

    const afterSecondUndo = undoEdit(afterUndo, key);
    expect(afterSecondUndo[key]).toEqual(["Original"]);
  });

  it("does nothing once a paragraph is back to its original text", () => {
    const key = paragraphKey(0, 0);
    const state = buildInitialEditState([page(["Original"])]);

    const result = undoEdit(state, key);

    expect(result).toBe(state);
    expect(result[key]).toEqual(["Original"]);
  });

  it("does nothing for a paragraph key that was never initialized", () => {
    const state = {};
    expect(undoEdit(state, paragraphKey(0, 0))).toBe(state);
  });
});
