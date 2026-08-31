"use client";

import { useRef, useState } from "react";
import { buildEditedPdf } from "@/lib/build-edited-pdf";
import { detectEmbeddedTextInFile } from "@/lib/detect-embedded-text";
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
import { reviseParagraph } from "@/lib/revise-paragraph";
import { sendPdfByEmail } from "@/lib/send-pdf-request";
import styles from "./page.module.css";

type UploadResult = {
  name: string;
  size: number;
};

// A client-only sanity cap on file size, not a server limit: the file
// never leaves the browser (see detect-embedded-text.ts), so this exists
// only to keep an accidental huge upload from stalling the page, not to
// work around any request-size ceiling.
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Unlike the upload above, the edited PDF has to reach the server to be
// attached and sent (the email API key can't safely live in the
// browser), so this one is a real limit: Vercel's Serverless Functions
// reject any request body over ~4.5 MB at the platform level. Checking
// client-side first means an oversized PDF gets a clear message instead
// of a platform-level rejection.
const MAX_EMAIL_ATTACHMENT_SIZE = 4 * 1024 * 1024; // 4 MB

type Status = "idle" | "reading" | "rendering" | "ocr" | "success" | "error";

// The AI revision flow for whichever paragraph is selected:
// idle - the textarea is editable, waiting for a submission.
// loading - a revision request is in flight.
// reviewing - a response came back; the user must confirm, retry, or edit
// their instructions before anything is applied to the paragraph.
type EditPhase = "idle" | "loading" | "reviewing";

// The "email me the edited PDF" flow, separate from the per-paragraph one
// above since it applies to the whole document rather than one paragraph.
type EmailPhase = "idle" | "sending" | "sent";

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
  const [editPhase, setEditPhase] = useState<EditPhase>("idle");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailPhase, setEmailPhase] = useState<EmailPhase>("idle");
  const [emailError, setEmailError] = useState<string | null>(null);
  // The originally uploaded file, kept around so the "email me the PDF"
  // flow can rebuild it with edits drawn in - see build-edited-pdf.ts.
  const [sourceFile, setSourceFile] = useState<File | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus("error");
      setMessage("Please choose a PDF file first.");
      return;
    }

    if (file.type !== "application/pdf") {
      setStatus("error");
      setMessage("Only PDF files are allowed.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setStatus("error");
      setMessage("File exceeds the 50 MB limit.");
      return;
    }

    setStatus("reading");
    setMessage(null);
    setResult(null);
    setPages(null);
    setOcrProgress(null);
    setEditState({});
    resetEditPanel();
    setEmailInput("");
    setEmailPhase("idle");
    setEmailError(null);
    setSourceFile(file);

    try {
      // Runs entirely client-side (see detect-embedded-text.ts) rather
      // than posting the file to a server route, so there's no request-body
      // size limit to work around for a large PDF.
      const detected = await detectEmbeddedTextInFile(file);

      let renderedPages: RenderedPage[];

      if (detected.source === "embedded") {
        setStatus("rendering");
        renderedPages = await renderEmbeddedPdfPages(file);
      } else {
        // No usable text layer, so this is likely a scan: run OCR in the browser.
        setStatus("ocr");
        const ocrResult = await renderPdfWithOcr(file, setOcrProgress);
        renderedPages = ocrResult.pages;
      }

      setResult({ name: file.name, size: file.size });
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

  function resetEditPanel() {
    setSelectedKey(null);
    setDraftEdit("");
    setEditPhase("idle");
    setAiResponse(null);
    setEditError(null);
  }

  function handleSelectParagraph(key: string) {
    setSelectedKey(key);
    setDraftEdit("");
    setEditPhase("idle");
    setAiResponse(null);
    setEditError(null);
  }

  async function requestRevision() {
    if (!selectedKey || draftEdit.trim().length === 0) {
      return;
    }

    setEditPhase("loading");
    setEditError(null);

    try {
      const revision = await reviseParagraph({
        currentText: getCurrentText(editState, selectedKey) ?? "",
        instructions: draftEdit.trim(),
      });
      setAiResponse(revision);
      setEditPhase("reviewing");
    } catch (error) {
      setEditPhase("idle");
      setEditError(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  function handleConfirm() {
    if (!selectedKey || aiResponse === null) {
      return;
    }
    setEditState((prev) => addEdit(prev, selectedKey, aiResponse));
    setDraftEdit("");
    setEditPhase("idle");
    setAiResponse(null);
  }

  function handleTryAgainWithEdits() {
    setEditPhase("idle");
    setAiResponse(null);
  }

  function handleUndo() {
    if (!selectedKey) {
      return;
    }
    setEditState((prev) => undoEdit(prev, selectedKey));
  }

  async function handleSendPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = emailInput.trim();
    if (email.length === 0 || !sourceFile || !pages) {
      return;
    }

    setEmailPhase("sending");
    setEmailError(null);

    try {
      const pdfBytes = await buildEditedPdf(sourceFile, pages, editState);

      if (pdfBytes.byteLength > MAX_EMAIL_ATTACHMENT_SIZE) {
        throw new Error("The edited PDF is too large to email (over 4 MB). Try a shorter document.");
      }

      await sendPdfByEmail(email, pdfBytes, sourceFile.name);
      setEmailPhase("sent");
    } catch (error) {
      setEmailPhase("idle");
      setEmailError(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  const busy = status === "reading" || status === "rendering" || status === "ocr";
  const selectedHistory = selectedKey ? editState[selectedKey] : undefined;

  return (
    <div className={styles.page}>
      <header className={styles.brandRow}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a tiny (42x43) static icon, not worth next/image's overhead */}
        <img src="/logo.png" alt="Buoyant" className={styles.logoMark} />
        <div>
          <h1 className={styles.title}>Buoyant</h1>
          <p className={styles.subtitle}>Seamlessly edit your proposals</p>
        </div>
      </header>

      <main className={styles.main}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input ref={inputRef} type="file" accept="application/pdf" />
          <button type="submit" disabled={busy}>
            {status === "reading"
              ? "Reading..."
              : status === "rendering"
                ? "Rendering..."
                : status === "ocr"
                  ? "Running OCR..."
                  : "Begin Revising"}
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
          <p role="status" className={styles.resultStatus}>
            <strong>{result.name}</strong> is ready to revise ({formatBytes(result.size)})
          </p>
        )}
      </main>

      {status === "success" && pages && pages.length > 0 && (
        <>
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
                      // An edited paragraph gets width/height *floors* rather
                      // than a fixed size: `fit-content` first grows the box
                      // sideways to fit replacement text that still reads as
                      // one line, up to the page's right edge (maxWidth), and
                      // only wraps - growing the box downward instead, via
                      // minHeight - once it hits that edge. So a short
                      // replacement widens in place, and only a long one
                      // reflows and grows vertically, rather than every edit
                      // immediately wrapping and needing a scrollbar.
                      ...(edited
                        ? {
                            width: "fit-content",
                            minWidth: `${(paragraph.width / page.width) * 100}%`,
                            maxWidth: `${((page.width - paragraph.x) / page.width) * 100}%`,
                            minHeight: `${(paragraph.height / page.height) * 100}%`,
                          }
                        : {
                            width: `${(paragraph.width / page.width) * 100}%`,
                            height: `${(paragraph.height / page.height) * 100}%`,
                          }),
                      // Matches the page background sampled from behind the
                      // original text, rather than a plain highlight color, so
                      // the edit blends into the page. Set here (inline) rather
                      // than in CSS so it also always wins over the generic
                      // hover tint below, whether hovered or not.
                      ...(edited ? { backgroundColor: paragraph.backgroundColor } : {}),
                    };
                    // Sized in container-width units (relative to the page
                    // image's own rendered width, via `.pageWrapper`'s
                    // `container-type: inline-size`) so edited text keeps the
                    // original's proportions as the page scales responsively.
                    const editedTextStyle = {
                      fontFamily: paragraph.fontFamily,
                      color: paragraph.color,
                      fontSize: `calc(${paragraph.fontSize} / ${page.width} * 100cqw)`,
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
                        {edited && (
                          <span className={styles.editedText} style={editedTextStyle}>
                            {currentText}
                          </span>
                        )}
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
                    {editPhase === "idle" && (
                      <>
                        <button
                          type="button"
                          className={styles.editSubmit}
                          onClick={requestRevision}
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
                      </>
                    )}

                    {editPhase === "loading" && (
                      <div className={styles.editLoading} role="status">
                        <span className={styles.spinner} aria-hidden="true" />
                        Getting AI revision...
                      </div>
                    )}

                    {editPhase === "reviewing" && (
                      <div className={styles.editReviewActions}>
                        <button type="button" className={styles.editSubmit} onClick={handleConfirm}>
                          Confirm
                        </button>
                        <div className={styles.editReviewSecondary}>
                          <button type="button" className={styles.editUndo} onClick={requestRevision}>
                            Try again
                          </button>
                          <button type="button" className={styles.editUndo} onClick={handleTryAgainWithEdits}>
                            Try again with edits
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className={styles.editPanelBody}>
                    <h2 className={styles.editPanelTitle}>Edit paragraph</h2>
                    <p className={styles.editPanelCurrent}>{selectedHistory[selectedHistory.length - 1]}</p>
                    <textarea
                      className={styles.editTextarea}
                      value={draftEdit}
                      onChange={(event) => setDraftEdit(event.target.value)}
                      rows={5}
                      placeholder="Describe the edit you want..."
                      disabled={editPhase !== "idle"}
                    />

                    {editPhase === "reviewing" && aiResponse !== null && (
                      <div className={styles.editAiResponse}>
                        <h3 className={styles.editAiResponseTitle}>AI suggestion</h3>
                        <p>{aiResponse}</p>
                      </div>
                    )}

                    {editError && (
                      <p role="alert" className={styles.error}>
                        {editError}
                      </p>
                    )}

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

          <section className={styles.emailSection}>
            <h2 className={styles.emailSectionTitle}>Email the edited PDF</h2>
            <p className={styles.emailSectionHint}>
              Enter your email and we&apos;ll send you a copy of the PDF with your revisions applied.
            </p>
            <form onSubmit={handleSendPdf} className={styles.emailForm}>
              <input
                type="email"
                className={styles.editTextarea}
                value={emailInput}
                onChange={(event) => {
                  setEmailInput(event.target.value);
                  setEmailPhase("idle");
                  setEmailError(null);
                }}
                placeholder="you@example.com"
                disabled={emailPhase === "sending"}
                required
              />
              <button
                type="submit"
                className={styles.editSubmit}
                disabled={emailPhase === "sending" || emailInput.trim().length === 0}
              >
                {emailPhase === "sending" ? "Sending..." : "Send PDF"}
              </button>
            </form>

            {emailPhase === "sent" && (
              <p role="status" className={styles.resultStatus}>
                Sent! Check your inbox at <strong>{emailInput.trim()}</strong>.
              </p>
            )}

            {emailError && (
              <p role="alert" className={styles.error}>
                {emailError}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
