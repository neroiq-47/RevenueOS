"use client";

import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./import.module.css";

const MAX_BYTES = 1024 * 1024;

type RowError = { row: number; field: string; message: string };
type State =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "success"; imported: number; contacts: number }
  | { kind: "error"; message: string; missingHeaders: string[]; errors: RowError[]; errorCount: number };

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImportForm() {
  const router = useRouter();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  function choose(f: File | null | undefined) {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setState({ kind: "error", message: "Please choose a .csv file.", missingHeaders: [], errors: [], errorCount: 0 });
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setState({ kind: "error", message: "That file is larger than 1 MB. Split it into smaller files.", missingHeaders: [], errors: [], errorCount: 0 });
      return;
    }
    setFile(f);
    setState({ kind: "idle" });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files?.[0]);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setState({ kind: "uploading" });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/import", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as
        | { imported?: number; contacts?: number; error?: string; missingHeaders?: string[]; errors?: RowError[]; errorCount?: number }
        | null;
      if (res.ok && data && typeof data.imported === "number") {
        setState({ kind: "success", imported: data.imported, contacts: data.contacts ?? 0 });
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
        return;
      }
      setState({
        kind: "error",
        message: data?.error ?? `Import failed (HTTP ${res.status}). Please try again.`,
        missingHeaders: data?.missingHeaders ?? [],
        errors: data?.errors ?? [],
        errorCount: data?.errorCount ?? data?.errors?.length ?? 0,
      });
    } catch {
      setState({ kind: "error", message: "Network error. Check your connection and try again.", missingHeaders: [], errors: [], errorCount: 0 });
    }
  }

  const uploading = state.kind === "uploading";

  return (
    <div className="stack">
      <form className={`card card--glow ${styles.form}`} onSubmit={onSubmit} aria-busy={uploading}>
        <label
          htmlFor={inputId}
          className={`${styles.drop} ${dragging ? styles.dropActive : ""} ${file ? styles.dropReady : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className={styles.dropIcon} aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 20h14" />
            </svg>
          </span>
          {file ? (
            <span className={styles.dropText}>
              <strong className="mono">{file.name}</strong>
              <span className="subtle mono">{formatBytes(file.size)}</span>
            </span>
          ) : (
            <span className={styles.dropText}>
              <strong>Drop a CSV here or click to browse</strong>
              <span id={hintId} className="subtle">
                .csv only · up to 1 MB · 1,000 rows
              </span>
            </span>
          )}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-describedby={file ? undefined : hintId}
            onChange={(e) => choose(e.target.files?.[0])}
            disabled={uploading}
          />
        </label>
        <div className={styles.actions}>
          <button type="submit" className="btn btn--primary" disabled={!file || uploading}>
            {uploading ? "Importing…" : "Import opportunities"}
          </button>
          {file && !uploading && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              Clear
            </button>
          )}
          <a href="/sample-opportunities.csv" download className="btn btn--ghost">
            Download sample CSV
          </a>
        </div>
      </form>

      <div aria-live="polite">
        {state.kind === "success" && (
          <div className={`alert alert--success ${styles.result}`} role="status">
            <span>
              Imported <strong className="mono">{state.imported}</strong> opportunit{state.imported === 1 ? "y" : "ies"} for{" "}
              <strong className="mono">{state.contacts}</strong> contact{state.contacts === 1 ? "" : "s"}.
            </span>
            <Link href="/app" className="btn btn--sm btn--primary">
              View pipeline →
            </Link>
          </div>
        )}
        {state.kind === "error" && (
          <div className={`alert alert--error ${styles.result}`} role="alert">
            <div className="stack" style={{ gap: 10, width: "100%" }}>
              <strong>{state.message}</strong>
              {state.missingHeaders.length > 0 && (
                <p style={{ margin: 0 }}>
                  Add these columns to the first row:{" "}
                  {state.missingHeaders.map((h, i) => (
                    <span key={h}>
                      {i > 0 && ", "}
                      <code className="mono">{h}</code>
                    </span>
                  ))}
                  . See the expected columns below.
                </p>
              )}
              {state.errors.length > 0 && (
                <div className={`table-wrap ${styles.errorTable}`}>
                  <table className="table">
                    <caption className="sr-only">Rows that need fixing</caption>
                    <thead>
                      <tr>
                        <th scope="col">Line</th>
                        <th scope="col">Column</th>
                        <th scope="col">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.errors.map((err, i) => (
                        <tr key={`${err.row}-${err.field}-${i}`}>
                          <td className="mono">{err.row === 0 ? "File" : err.row + 1}</td>
                          <td className="mono">{err.field}</td>
                          <td>{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {state.errorCount > state.errors.length && (
                <p style={{ margin: 0 }} className="subtle">
                  Showing the first {state.errors.length} of {state.errorCount} problems.
                </p>
              )}
              {state.errors.some((e) => e.row > 0) && (
                <p style={{ margin: 0, fontSize: 13 }} className="subtle">
                  Line numbers match your spreadsheet (line 1 is the header row).
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
