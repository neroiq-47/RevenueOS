"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OpportunityStage } from "@/lib/database.types";
import styles from "./dashboard.module.css";

type Outcome = "won" | "lost" | "followed_up" | "reopen";

const LABELS: Record<Outcome, string> = {
  followed_up: "Followed up",
  won: "Mark won",
  lost: "Mark lost",
  reopen: "Reopen",
};

/** Records a deal outcome via PATCH /api/opportunities/:id, then refreshes server data. */
export function OutcomeControl({
  opportunityId,
  opportunityTitle,
  stage,
  compact = false,
}: {
  opportunityId: string;
  opportunityTitle: string;
  stage: OpportunityStage;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const outcomes: Outcome[] = stage === "open" ? ["followed_up", "won", "lost"] : ["reopen"];

  async function submit(outcome: Outcome) {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${encodeURIComponent(opportunityId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Could not update. Please try again.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || pending;

  return (
    <div className={styles.outcome}>
      <div className={styles.outcomeButtons} role="group" aria-label={`Update outcome for ${opportunityTitle}`}>
        {outcomes.map((o) => (
          <button
            key={o}
            type="button"
            className={`btn btn--sm ${o === "won" ? styles.btnWon : o === "lost" ? "btn--danger" : compact ? "btn--ghost" : ""}`}
            onClick={() => submit(o)}
            disabled={disabled}
            aria-busy={busy === o}
          >
            {busy === o ? "Saving…" : LABELS[o]}
          </button>
        ))}
      </div>
      {error && (
        <p className={styles.outcomeError} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
