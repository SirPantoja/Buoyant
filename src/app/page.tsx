"use client";

import { useRef, useState } from "react";
import styles from "./page.module.css";

type UploadResult = {
  name: string;
  size: number;
};

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

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

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      setStatus("success");
      setResult({ name: data.name, size: data.size });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Upload a PDF</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input ref={inputRef} type="file" accept="application/pdf" />
          <button type="submit" disabled={status === "uploading"}>
            {status === "uploading" ? "Uploading..." : "Upload"}
          </button>
        </form>

        {status === "success" && result && (
          <p role="status">
            Uploaded <strong>{result.name}</strong> ({formatBytes(result.size)})
          </p>
        )}
        {status === "error" && message && (
          <p role="alert" className={styles.error}>
            {message}
          </p>
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
