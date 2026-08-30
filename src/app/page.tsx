"use client";

import { useRef, useState } from "react";
import { renderPdfWithOcr, type OcrProgress } from "@/lib/ocr";
import {
  addEdit,
  buildInitialEditState,
  getCurrentText,
  hasEdits,
  paragraphKey,
  undoEdit,
  type ParagraphEditState,
} from "@/lib/paragraph-edits";
import type { RenderedPage } from "@/lib/pdf-paragraphs";
import { renderEmbeddedPdfPages } from "@/lib/render-pdf-pages";
import styles from "./page.module.css";

type Source = "embedded" | "ocr";

type UploadResult = {
  name: string;
  size: number;
  text: string;
  source: Source;
};

type UploadResponse = {
  name: string;
  size: number;
  source: "embedded" | "ocr-required";
  text: string | null;
};

type Status = "idle" | "uploading" | "rendering" | "ocr" | "success" | "error";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [editState, setEditState] = useState<ParagraphEditState>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Please choose a PDF file first.");
      return;
    }

    setStatus("uploading");
    setMessage(null);
    setResult(null);
    setPages(null);
    setOcrProgress(null);
    setEditState({});
    setSelectedKey(null);
    setDraftEdit("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data: UploadResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      let renderedPages: RenderedPage[];
      let text: string;

      if (data.source === "embedded" && data.text !== null) {
        setStatus("rendering");
        renderedPages = await renderEmbeddedPdfPages(file);
        text = data.text;
      } else {
        // No usable text layer, so this is likely a scan: run OCR in the browser.
        setStatus("ocr");
        const ocrResult = await renderPdfWithOcr(file, setOcrProgress);
        renderedPages = ocrResult.pages;
        text = ocrResult.text;
      }

      setResult({ name: data.name, size: data.size, text, source: data.source === "embedded" ? "embedded" : "ocr" });
      setPages(renderedPages);
      setEditState(buildInitialEditState(renderedPages));
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setOcrProgress(null);
    }
  }

  function handleSelectParagraph(key: string) {
    setSelectedKey(key);
    setDraftEdit("");
  }

  function handleSubmitEdit() {
    if (!selectedKey || draftEdit.trim().length === 0) {
      return;
    }
    setEditState((prev) => addEdit(prev, selectedKey, draftEdit.trim()));
    setDraftEdit("");
  }

  function handleUndo() {
    if (!selectedKey) {
      return;
    }
    setEditState((prev) => undoEdit(prev, selectedKey));
  }

  const busy = status === "uploading" || status === "rendering" || status === "ocr";
  const selectedHistory = selectedKey ? editState[selectedKey] : undefined;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Upload a PDF</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input ref={inputRef} type="file" accept="application/pdf" />
          <button type="submit" disabled={busy}>
            {status === "uploading"
              ? "Uploading..."
              : status === "rendering"
                ? "Rendering..."
                : status === "ocr"
                  ? "Running OCR..."
                  : "Upload"}
          </button>
        </form>

        {status === "ocr" && ocrProgress && (
          <p role="status">
            {ocrProgress.status === "rendering" ? "Rendering" : "Reading"} page {ocrProgress.page} of{" "}
            {ocrProgress.totalPages}...
          </p>
        )}

        {status === "error" && message && (
          <p role="alert" className={styles.error}>
            {message}
          </p>
        )}

        {status === "success" && result && (
          <div className={styles.result}>
            <p role="status">
              Read <strong>{result.name}</strong> ({formatBytes(result.size)})
            </p>
            <span
              className={`${styles.badge} ${
                result.source === "embedded" ? styles.badgeEmbedded : styles.badgeOcr
              }`}
            >
              {result.source === "embedded" ? "Detected via PDF text metadata" : "Detected via Tesseract OCR"}
            </span>
            <pre className={styles.text}>{result.text || "(no text found)"}</pre>
          </div>
        )}
      </main>

      {status === "success" && pages && pages.length > 0 && (
        <div className={styles.viewer}>
          <div className={styles.pages}>
            {pages.map((page, pageIndex) => (
              <div
                key={pageIndex}
                className={styles.pageWrapper}
                style={{ aspectRatio: `${page.width} / ${page.height}` }}
              >
                {/* Rendered client-side from the PDF, so it's a data URL rather than a static asset. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.dataUrl} alt={`Page ${pageIndex + 1}`} className={styles.pageImage} />
                {page.paragraphs.map((paragraph, paragraphIndex) => {
                  const key = paragraphKey(pageIndex, paragraphIndex);
                  const edited = hasEdits(editState, key);
                  const currentText = getCurrentText(editState, key) ?? paragraph.text;
                  const boxStyle = {
                    left: `${(paragraph.x / page.width) * 100}%`,
                    top: `${(paragraph.y / page.height) * 100}%`,
                    width: `${(paragraph.width / page.width) * 100}%`,
                    height: `${(paragraph.height / page.height) * 100}%`,
                  };

                  return (
                    <div
                      key={paragraphIndex}
                      className={`${styles.paragraphBox} ${edited ? styles.paragraphBoxEdited : ""} ${
                        selectedKey === key ? styles.paragraphBoxSelected : ""
                      }`}
                      title={currentText}
                      onClick={() => handleSelectParagraph(key)}
                      style={boxStyle}
                    >
                      {edited && <span className={styles.editedText}>{currentText}</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <aside className={styles.editPanel}>
            {selectedKey && selectedHistory ? (
              <>
                <div className={styles.editActions}>
                  <button
                    type="button"
                    className={styles.editSubmit}
                    onClick={handleSubmitEdit}
                    disabled={draftEdit.trim().length === 0}
                  >
                    Submit revisions
                  </button>
                  <button
                    type="button"
                    className={styles.editUndo}
                    onClick={handleUndo}
                    disabled={!hasEdits(editState, selectedKey)}
                  >
                    Undo
                  </button>
                </div>

                <div className={styles.editPanelBody}>
                  <h2 className={styles.editPanelTitle}>Edit paragraph</h2>
                  <p className={styles.editPanelCurrent}>{selectedHistory[selectedHistory.length - 1]}</p>
                  <textarea
                    className={styles.editTextarea}
                    value={draftEdit}
                    onChange={(event) => setDraftEdit(event.target.value)}
                    rows={5}
                    placeholder="Type your replacement text..."
                  />

                  {selectedHistory.length > 1 && (
                    <div className={styles.editHistory}>
                      <h3 className={styles.editHistoryTitle}>History</h3>
                      <ol className={styles.editHistoryList}>
                        {selectedHistory.map((entry, index) => (
                          <li key={index}>
                            <span className={styles.editHistoryLabel}>
                              {index === 0 ? "Original" : `Edit ${index}`}
                            </span>
                            {entry}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className={styles.editPanelPlaceholder}>Click a paragraph to edit it.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
