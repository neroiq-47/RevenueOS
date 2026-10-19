"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import styles from "./billing/draft-panel.module.css";

/**
 * Generates, shows and copies an AI follow-up draft for one opportunity.
 * Contract: POST /api/drafts { opportunityId } -> { draft: { id, content, created_at }, remaining } | { error }
 *           GET  /api/drafts?opportunityId=     -> { draft | null, remaining }
 */

type DraftDto = { id: string; content: string; created_at: string };
type ApiResponse = { draft?: DraftDto | null; remaining?: number | null; error?: string };
type PanelError = { message: string; billing?: boolean };

function errorFor(status: number, message?: string): PanelError {
  if (status === 402) return { message: "An active subscription is required for AI drafts.", billing: true };
  if (status === 401) return { message: "Your session has expired. Please sign in again." };
  if (status === 429) return { message: message ?? "You've hit the draft limit. Please try again later." };
  if (status === 404) return { message: "This opportunity no longer exists." };
  if (status === 503) return { message: "AI drafts are not available right now." };
  return { message: message ?? "Something went wrong. Please try again." };
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function DraftPanel({
  opportunityId,
  opportunityTitle,
  contactName,
}: {
  opportunityId: string;
  opportunityTitle: string;
  contactName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<"load" | "generate" | null>(null);
  const [draft, setDraft] = useState<DraftDto | null>(null);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<PanelError | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const panelId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyDraft(d: DraftDto | null) {
    setDraft(d);
    setText(d?.content ?? "");
    setCopied(null);
  }

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId }),
      });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok || !json.draft) {
        setError(errorFor(res.status, json.error));
        return;
      }
      applyDraft(json.draft);
      if (json.remaining !== undefined) setRemaining(json.remaining);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      setError({ message: "Network error. Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function openPanel() {
    setOpen(true);
    if (loaded) return;
    setBusy("load");
    setError(null);
    try {
      const res = await fetch(`/api/drafts?opportunityId=${encodeURIComponent(opportunityId)}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as ApiResponse;
      if (!res.ok) {
        setError(errorFor(res.status, json.error));
        setBusy(null);
        return;
      }
      setLoaded(true);
      if (json.remaining !== undefined) setRemaining(json.remaining);
      if (json.draft) {
        applyDraft(json.draft);
        setBusy(null);
      } else {
        setBusy(null);
        await generate();
      }
    } catch {
      setError({ message: "Network error. Check your connection and try again." });
      setBusy(null);
    }
  }

  async function onCopy() {
    const ok = await copyText(text);
    setCopied(ok ? "ok" : "fail");
    if (ok) setTimeout(() => setCopied(null), 2000);
    else textareaRef.current?.select();
  }

  const edited = draft !== null && text !== draft.content;
  const outOfQuota = remaining === 0;

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={`btn btn--sm ${open ? "btn--ghost" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? setOpen(false) : void openPanel())}
        disabled={busy === "load"}
      >
        <span aria-hidden="true">✦</span>
        {open ? "Hide draft" : busy === "load" ? "Loading…" : "Generate draft"}
      </button>

      {open && (
        <div id={panelId} className={`card ${styles.panel}`} role="region" aria-label={`Follow-up draft for ${opportunityTitle}`}>
          <div className={styles.head}>
            <div className={styles.headText}>
              <span className={styles.kicker}>AI follow-up draft</span>
              <span className={styles.subject} title={opportunityTitle}>
                {opportunityTitle}
                {contactName ? <span className="muted"> · {contactName}</span> : null}
              </span>
            </div>
            {remaining !== null && (
              <span className={`badge ${outOfQuota ? "badge--warning" : "badge--brand"}`} title="AI drafts left this month">
                {remaining} left
              </span>
            )}
          </div>

          {error && (
            <div className="alert alert--error" role="alert">
              {error.message}{" "}
              {error.billing && (
                <Link href="/app/billing" className={styles.link}>
                  Go to billing
                </Link>
              )}
            </div>
          )}

          {busy === "generate" && !draft && (
            <div className={styles.skeleton} aria-live="polite">
              <span />
              <span />
              <span />
              <p className="subtle">Writing a draft…</p>
            </div>
          )}

          {draft && (
            <>
              <label className="sr-only" htmlFor={`${panelId}-text`}>
                Draft text (editable)
              </label>
              <textarea
                id={`${panelId}-text`}
                ref={textareaRef}
                className={`textarea ${styles.textarea}`}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setCopied(null);
                }}
                maxLength={4000}
                rows={9}
                spellCheck
                aria-busy={busy === "generate"}
              />
              <div className={styles.actions}>
                <button type="button" className="btn btn--sm btn--primary" onClick={onCopy} disabled={!text.trim()}>
                  {copied === "ok" ? "Copied ✓" : "Copy"}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => void generate()}
                  disabled={busy !== null || outOfQuota}
                  title={outOfQuota ? "Monthly draft limit reached" : undefined}
                >
                  {busy === "generate" ? "Regenerating…" : "Regenerate"}
                </button>
                {edited && (
                  <button type="button" className="btn btn--sm btn--ghost" onClick={() => setText(draft.content)}>
                    Reset edits
                  </button>
                )}
              </div>
              {copied === "fail" && (
                <p className={styles.note} role="status">
                  Couldn&apos;t access the clipboard — the text is selected, press Ctrl/⌘+C to copy.
                </p>
              )}
            </>
          )}

          {!draft && !busy && loaded && !error && (
            <button type="button" className="btn btn--sm btn--primary" onClick={() => void generate()} disabled={outOfQuota}>
              Generate draft
            </button>
          )}
          {!draft && !busy && error && !error.billing && (
            <div>
              <button type="button" className="btn btn--sm" onClick={() => void (loaded ? generate() : openPanel())}>
                Try again
              </button>
            </div>
          )}

          <p className={styles.note}>
            AI-written suggestion — review before sending. RevenueOS never sends email — copy and send it yourself.
          </p>
        </div>
      )}
    </div>
  );
}
