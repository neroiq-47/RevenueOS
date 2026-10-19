import type { Metadata } from "next";
import Link from "next/link";
import { requireEntitledOrg, type OrgContext } from "@/lib/org";
import { serverEnv } from "@/lib/env";
import type { OpportunityStage } from "@/lib/database.types";
import {
  formatMoney,
  formatTotals,
  getStaleOpportunities,
  isStale,
  normalizeThreshold,
  summarize,
  wholeDaysInactive,
} from "@/lib/stale";
import { DraftPanel } from "@/components/DraftPanel";
import { OutcomeControl } from "./OutcomeControl";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Pipeline · RevenueOS" };
export const dynamic = "force-dynamic";

type StageFilter = OpportunityStage | "all";
const FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const PAGE_SIZE = 1000; // Supabase's default max rows per request
const MAX_LOADED = 10_000;

type DashboardOpportunity = {
  id: string;
  title: string;
  amount_cents: number;
  currency: string;
  stage: OpportunityStage;
  last_activity_at: string;
  contact: { name: string; email: string } | null;
};

async function loadOpportunities(ctx: OrgContext): Promise<{ opps: DashboardOpportunity[]; error: boolean; truncated: boolean }> {
  const opps: DashboardOpportunity[] = [];
  for (let from = 0; from < MAX_LOADED; from += PAGE_SIZE) {
    const { data, error } = await ctx.supabase
      .from("opportunities")
      .select("id, title, amount_cents, currency, stage, last_activity_at, contacts(name, email)")
      .eq("organization_id", ctx.org.id)
      .order("last_activity_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      console.error("dashboard: failed to load opportunities", error.code);
      return { opps, error: true, truncated: false };
    }
    for (const row of data ?? []) {
      const c = row.contacts as { name: string; email: string } | { name: string; email: string }[] | null;
      opps.push({
        id: row.id,
        title: row.title,
        amount_cents: Number(row.amount_cents),
        currency: row.currency,
        stage: row.stage,
        last_activity_at: row.last_activity_at,
        contact: Array.isArray(c) ? (c[0] ?? null) : c,
      });
    }
    if (!data || data.length < PAGE_SIZE) return { opps, error: false, truncated: false };
  }
  return { opps, error: false, truncated: true };
}

const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

function parseFilter(raw: string | string[] | undefined): StageFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "open" || v === "won" || v === "lost" ? v : "all";
}

function StageBadge({ stage }: { stage: OpportunityStage }) {
  const cls = stage === "won" ? "badge--success" : stage === "lost" ? "badge--danger" : "badge--brand";
  return <span className={`badge ${cls}`}>{stage[0].toUpperCase() + stage.slice(1)}</span>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await requireEntitledOrg();
  const { stage: stageParam } = await searchParams;
  const filter = parseFilter(stageParam);
  const threshold = normalizeThreshold(serverEnv.staleDays());
  const now = new Date();

  const { opps, error, truncated } = await loadOpportunities(ctx);

  if (error) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Pipeline</h1>
        <div className="alert alert--error" role="alert">
          We couldn&apos;t load your opportunities. Please refresh the page in a moment.
        </div>
      </div>
    );
  }

  const ruleNote = (
    <p className={`${styles.ruleNote} subtle`}>
      Rule: open deals with no activity for <code>{threshold}+</code> days are flagged as stale, largest first.
    </p>
  );

  if (opps.length === 0) {
    return (
      <div className={styles.page}>
        <header>
          <span className="eyebrow">
            <span className="dot" /> Revenue recovery
          </span>
          <h1 className={styles.title}>Pipeline</h1>
          {ruleNote}
        </header>
        <section className={`card card--glow ${styles.empty}`} aria-labelledby="empty-title">
          <div className={styles.emptyIcon} aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </div>
          <h2 id="empty-title" className={styles.emptyTitle}>
            Import your open quotes to find <span className="gradient-text">revenue at risk</span>
          </h2>
          <p className={`${styles.emptyText} muted`}>
            Upload a CSV of deals with a contact, amount and last activity date. We&apos;ll flag the ones that have gone
            quiet so you can follow up before they slip away.
          </p>
          <div className={styles.emptyActions}>
            <Link href="/app/import" className="btn btn--primary">
              Import CSV
            </Link>
            <a href="/sample-opportunities.csv" download className="btn">
              Download sample CSV
            </a>
          </div>
        </section>
      </div>
    );
  }

  const summary = summarize(opps, now, threshold);
  const stale = getStaleOpportunities(opps, now, threshold);
  const counts: Record<StageFilter, number> = {
    all: opps.length,
    open: summary.openCount,
    won: summary.wonCount,
    lost: summary.lostCount,
  };
  const visible = filter === "all" ? opps : opps.filter((o) => o.stage === filter);
  const fallback = summary.primaryCurrency;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className="eyebrow">
            <span className="dot" /> Revenue recovery
          </span>
          <h1 className={styles.title}>Pipeline</h1>
          {ruleNote}
        </div>
        <Link href="/app/import" className="btn btn--sm">
          Import CSV
        </Link>
      </header>

      {truncated && (
        <div className="alert alert--info" role="status">
          Showing the {MAX_LOADED.toLocaleString("en-US")} most recently active opportunities.
        </div>
      )}

      <section aria-label="Pipeline summary" className={styles.stats}>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statLabel}>
            <span className={styles.statDot} aria-hidden="true" /> Open pipeline
          </span>
          <span className={styles.statValue}>{formatTotals(summary.openValue, fallback)}</span>
          <span className={styles.statSub}>
            {summary.openCount} open deal{summary.openCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className={`card card--glow ${styles.stat} ${summary.staleCount > 0 ? styles.statRisk : ""}`}>
          <span className={styles.statLabel}>
            <span className={`${styles.statDot} ${styles.statDotWarn}`} aria-hidden="true" /> Stale · value at risk
          </span>
          <span className={styles.statValue}>{formatTotals(summary.staleValue, fallback)}</span>
          <span className={styles.statSub}>
            {summary.staleCount} stale deal{summary.staleCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statLabel}>
            <span className={`${styles.statDot} ${styles.statDotGood}`} aria-hidden="true" /> Won
          </span>
          <span className={styles.statValue}>{summary.wonCount}</span>
          <span className={styles.statSub}>{formatTotals(summary.wonValue, fallback)}</span>
        </div>
        <div className={`card ${styles.stat}`}>
          <span className={styles.statLabel}>
            <span className={`${styles.statDot} ${styles.statDotBad}`} aria-hidden="true" /> Lost
          </span>
          <span className={styles.statValue}>{summary.lostCount}</span>
          <span className={styles.statSub}>{formatTotals(summary.lostValue, fallback)}</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="stale-heading">
        <div className={styles.sectionHead}>
          <h2 id="stale-heading" className={styles.sectionTitle}>
            Stale — follow up now
            <span className={`badge ${stale.length > 0 ? "badge--warning" : "badge--success"}`}>{stale.length}</span>
          </h2>
        </div>
        {stale.length === 0 ? (
          <div className={`card card--pad ${styles.allClear}`}>
            <span className="badge badge--success">All clear</span>
            <span className="muted">Every open deal has had activity in the last {threshold} days.</span>
          </div>
        ) : (
          <ul className={styles.staleList}>
            {stale.map((o) => {
              const days = wholeDaysInactive(o.last_activity_at, now);
              return (
                <li key={o.id} className={`card ${styles.staleItem}`}>
                  <div className={styles.staleTop}>
                    <div className={styles.staleMain}>
                      <h3 className={styles.staleTitle}>{o.title}</h3>
                      <span className={styles.staleContact}>
                        {o.contact ? (
                          <>
                            {o.contact.name} · <span className="mono">{o.contact.email}</span>
                          </>
                        ) : (
                          "No contact"
                        )}
                      </span>
                    </div>
                    <div className={styles.staleMeta}>
                      <span className={styles.amount}>{formatMoney(o.amount_cents, o.currency)}</span>
                      <span className={`badge ${days >= threshold * 2 ? "badge--danger" : "badge--warning"}`}>
                        {days} days inactive
                      </span>
                      <span className="subtle" style={{ fontSize: 13 }}>
                        Last activity <time dateTime={o.last_activity_at}>{formatDate(o.last_activity_at)}</time>
                      </span>
                    </div>
                  </div>
                  <div className={styles.staleActions}>
                    <DraftPanel opportunityId={o.id} opportunityTitle={o.title} contactName={o.contact?.name ?? null} />
                    <OutcomeControl opportunityId={o.id} opportunityTitle={o.title} stage={o.stage} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className={styles.section} aria-labelledby="all-heading">
        <div className={styles.sectionHead}>
          <h2 id="all-heading" className={styles.sectionTitle}>
            All opportunities
          </h2>
          <nav className={styles.filters} aria-label="Filter by stage">
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === "all" ? "/app" : `/app?stage=${f.value}`}
                className={`${styles.filter} ${filter === f.value ? styles.filterActive : ""}`}
                aria-current={filter === f.value ? "page" : undefined}
                scroll={false}
              >
                {f.label}
                <span className={styles.filterCount}>{counts[f.value]}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="card">
          {visible.length === 0 ? (
            <p className="muted" style={{ padding: 24, margin: 0 }}>
              No {filter === "all" ? "" : `${filter} `}opportunities.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <caption className="sr-only">
                  {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)} opportunities, most recent activity first
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Deal</th>
                    <th scope="col">Stage</th>
                    <th scope="col" className={styles.thRight}>
                      Amount
                    </th>
                    <th scope="col">Last activity</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((o) => {
                    const staleNow = isStale(o, now, threshold);
                    return (
                      <tr key={o.id}>
                        <td>
                          <div className={styles.cellTitle}>{o.title}</div>
                          <div className={styles.cellSub}>
                            {o.contact ? `${o.contact.name} · ${o.contact.email}` : "No contact"}
                          </div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <StageBadge stage={o.stage} />
                            {staleNow && <span className="badge badge--warning">Stale</span>}
                          </div>
                        </td>
                        <td className={styles.num}>{formatMoney(o.amount_cents, o.currency)}</td>
                        <td className={styles.nowrap}>
                          <time dateTime={o.last_activity_at}>{formatDate(o.last_activity_at)}</time>
                          <div className={`${styles.cellSub} mono`}>{wholeDaysInactive(o.last_activity_at, now)}d ago</div>
                        </td>
                        <td>
                          <OutcomeControl opportunityId={o.id} opportunityTitle={o.title} stage={o.stage} compact />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
