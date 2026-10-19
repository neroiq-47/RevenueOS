"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";

type Deleted = { drafts: number; opportunities: number; contacts: number };

export function DeleteDataForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<Deleted | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (confirm !== "DELETE" || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const json = (await res.json().catch(() => ({}))) as { deleted?: Deleted; error?: string };
      if (!res.ok || !json.deleted) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setDeleted(json.deleted);
      setOpen(false);
      setConfirm("");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.deleteBox}>
      {deleted && (
        <div className="alert alert--success" role="status">
          Deleted {deleted.contacts} contacts, {deleted.opportunities} opportunities and {deleted.drafts} drafts.
        </div>
      )}

      {!open ? (
        <div>
          <button type="button" className="btn btn--danger" onClick={() => { setOpen(true); setDeleted(null); }}>
            Delete all opportunity data
          </button>
        </div>
      ) : (
        <form className={styles.confirmForm} onSubmit={onSubmit}>
          <label className="field">
            <span className="label">
              Type <span className="mono">DELETE</span> to confirm
            </span>
            <input
              className="input mono"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              autoFocus
              aria-describedby="delete-help"
            />
          </label>
          <p id="delete-help" className="subtle">
            Tip: export your data first if you might need it later.
          </p>
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}
          <div className="row row--wrap">
            <button type="submit" className="btn btn--danger" disabled={confirm !== "DELETE" || busy}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={busy}
              onClick={() => { setOpen(false); setConfirm(""); setError(null); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
