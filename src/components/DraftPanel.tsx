"use client";

/**
 * Generates, shows and copies an AI follow-up draft for one opportunity.
 * Contract: POST /api/drafts { opportunityId } -> { draft: { id, content, created_at }, remaining } | { error }
 */
export function DraftPanel(props: { opportunityId: string; opportunityTitle: string; contactName?: string | null }) {
  return <button className="btn btn--sm" disabled>Generate draft</button>;
}
