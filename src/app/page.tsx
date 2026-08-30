"use client";

import { useRef, useState } from "react";
import { extractTextWithOcr, type OcrProgress } from "@/lib/ocr";
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

type Status = "idle" | "uploading" | "ocr" | "success" | "error";

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);

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
    setOcrProgress(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data: UploadResponse & { error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      if (data.source === "embedded" && data.text !== null) {
        setResult({ name: data.name, size: data.size, text: data.text, source: "embedded" });
        setStatus("success");
        return;
      }

      // No usable text layer, so this is likely a scan: run OCR in the browser.
      setStatus("ocr");
      const text = await extractTextWithOcr(file, setOcrProgress);
      setResult({ name: data.name, size: data.size, text, source: "ocr" });
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setOcrProgress(null);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Upload a PDF</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input ref={inputRef} type="file" accept="application/pdf" />
          <button type="submit" disabled={status === "uploading" || status === "ocr"}>
            {status === "uploading"
              ? "Uploading..."
              : status === "ocr"
                ? "Running OCR..."
                : "Upload"}
          </button>
        </form>

        {status === "ocr" && ocrProgress && (
          <p role="status">
            {ocrProgress.status === "rendering" ? "Rendering" : "Reading"} page{" "}
            {ocrProgress.page} of {ocrProgress.totalPages}...
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
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
