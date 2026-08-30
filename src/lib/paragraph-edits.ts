import type { RenderedPage } from "./pdf-paragraphs";

// Each paragraph's history is [originalText, edit1, edit2, ...], with the
// current text always the last entry. Keeping every past version (rather
// than just the latest) is what makes undo straightforward to add later:
// undoing is just popping the last entry, as long as one remains.
export type ParagraphHistory = string[];
export type ParagraphEditState = Record<string, ParagraphHistory>;

export function paragraphKey(pageIndex: number, paragraphIndex: number): string {
  return `${pageIndex}:${paragraphIndex}`;
}

export function buildInitialEditState(pages: RenderedPage[]): ParagraphEditState {
  const state: ParagraphEditState = {};

  pages.forEach((page, pageIndex) => {
    page.paragraphs.forEach((paragraph, paragraphIndex) => {
      state[paragraphKey(pageIndex, paragraphIndex)] = [paragraph.text];
    });
  });

  return state;
}

export function addEdit(state: ParagraphEditState, key: string, newText: string): ParagraphEditState {
  const history = state[key] ?? [];
  return { ...state, [key]: [...history, newText] };
}

export function getCurrentText(state: ParagraphEditState, key: string): string | undefined {
  const history = state[key];
  return history?.[history.length - 1];
}

export function hasEdits(state: ParagraphEditState, key: string): boolean {
  return (state[key]?.length ?? 0) > 1;
}

// Permanently drops the latest edit, falling back to the previous version
// (or the original). There's no redo: once undone, that edit is gone. A
// paragraph already at its original text is left untouched.
export function undoEdit(state: ParagraphEditState, key: string): ParagraphEditState {
  const history = state[key];
  if (!history || history.length <= 1) {
    return state;
  }
  return { ...state, [key]: history.slice(0, -1) };
}
