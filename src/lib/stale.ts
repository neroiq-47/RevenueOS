/**
 * Deterministic v1 stale rule (pure, no I/O).
 *
 * An opportunity is "stale" when it is still OPEN and its last activity is at least
 * `thresholdDays` (default 7) days old. Stale deals are ordered by amount (largest first),
 * then by inactivity (oldest activity first) so the most valuable, most neglected deals lead.
 */
import type { OpportunityStage } from "@/lib/database.types";

export const DEFAULT_STALE_DAYS = 7;
const MS_PER_DAY = 86_400_000;

/** The minimum fields the stale rule needs. Works with full Opportunity rows too. */
export type StaleInput = {
  id?: string;
  stage: OpportunityStage;
  amount_cents: number;
  currency: string;
  last_activity_at: string | Date;
};

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

/** Normalises a threshold: falls back to the default for non-finite or negative values. */
export function normalizeThreshold(thresholdDays: number | undefined): number {
  return typeof thresholdDays === "number" && Number.isFinite(thresholdDays) && thresholdDays >= 0
    ? thresholdDays
    : DEFAULT_STALE_DAYS;
}

/**
 * Fractional days since the last activity. Future timestamps return 0; unparseable dates
 * return NaN (and are therefore never stale).
 */
export function daysInactive(lastActivityAt: string | Date, now: Date = new Date()): number {
  const t = toTime(lastActivityAt);
  if (Number.isNaN(t)) return Number.NaN;
  return Math.max(0, (now.getTime() - t) / MS_PER_DAY);
}

/** Whole days since the last activity, for display ("12 days"). */
export function wholeDaysInactive(lastActivityAt: string | Date, now: Date = new Date()): number {
  const d = daysInactive(lastActivityAt, now);
  return Number.isNaN(d) ? 0 : Math.floor(d);
}

export function isStale(
  opp: Pick<StaleInput, "stage" | "last_activity_at">,
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_STALE_DAYS,
): boolean {
  if (opp.stage !== "open") return false;
  const days = daysInactive(opp.last_activity_at, now);
  if (Number.isNaN(days)) return false;
  return days >= normalizeThreshold(thresholdDays);
}

/**
 * Sorts by amount descending, then by last activity ascending (older = more inactive first),
 * then by id for a stable, deterministic order. Returns a new array.
 */
export function sortStale<T extends StaleInput>(opps: readonly T[]): T[] {
  return [...opps].sort((a, b) => {
    if (b.amount_cents !== a.amount_cents) return b.amount_cents - a.amount_cents;
    const ta = toTime(a.last_activity_at);
    const tb = toTime(b.last_activity_at);
    if (ta !== tb) {
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return ta - tb;
    }
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

export function getStaleOpportunities<T extends StaleInput>(
  opps: readonly T[],
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_STALE_DAYS,
): T[] {
  return sortStale(opps.filter((o) => isStale(o, now, thresholdDays)));
}

/** Amounts in minor units (cents), keyed by ISO currency code. */
export type CurrencyTotals = Record<string, number>;

export type PipelineSummary = {
  openCount: number;
  staleCount: number;
  wonCount: number;
  lostCount: number;
  /** Totals per currency, so mixed-currency pipelines are never summed incorrectly. */
  openValue: CurrencyTotals;
  staleValue: CurrencyTotals;
  wonValue: CurrencyTotals;
  lostValue: CurrencyTotals;
  /** Most common currency across all opportunities (ties: alphabetical; empty data: USD). */
  primaryCurrency: string;
  /** Open / stale value in `primaryCurrency` only. */
  openValueCents: number;
  staleValueCents: number;
};

function add(totals: CurrencyTotals, currency: string, cents: number) {
  totals[currency] = (totals[currency] ?? 0) + cents;
}

export function summarize(
  opps: readonly StaleInput[],
  now: Date = new Date(),
  thresholdDays: number = DEFAULT_STALE_DAYS,
): PipelineSummary {
  const s: PipelineSummary = {
    openCount: 0,
    staleCount: 0,
    wonCount: 0,
    lostCount: 0,
    openValue: {},
    staleValue: {},
    wonValue: {},
    lostValue: {},
    primaryCurrency: "USD",
    openValueCents: 0,
    staleValueCents: 0,
  };
  const currencyCounts = new Map<string, number>();

  for (const o of opps) {
    const cur = o.currency || "USD";
    currencyCounts.set(cur, (currencyCounts.get(cur) ?? 0) + 1);
    if (o.stage === "open") {
      s.openCount++;
      add(s.openValue, cur, o.amount_cents);
      if (isStale(o, now, thresholdDays)) {
        s.staleCount++;
        add(s.staleValue, cur, o.amount_cents);
      }
    } else if (o.stage === "won") {
      s.wonCount++;
      add(s.wonValue, cur, o.amount_cents);
    } else if (o.stage === "lost") {
      s.lostCount++;
      add(s.lostValue, cur, o.amount_cents);
    }
  }

  let best: [string, number] | null = null;
  for (const entry of [...currencyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  if (best) s.primaryCurrency = best[0];
  s.openValueCents = s.openValue[s.primaryCurrency] ?? 0;
  s.staleValueCents = s.staleValue[s.primaryCurrency] ?? 0;
  return s;
}

/** Formats minor units as currency, e.g. formatMoney(123450, "USD") -> "$1,234.50". */
export function formatMoney(cents: number, currency: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

/** Formats every currency in a totals map, largest first: "$12,000 · €3,500". Empty → formatted zero. */
export function formatTotals(totals: CurrencyTotals, fallbackCurrency = "USD"): string {
  const entries = Object.entries(totals).filter(([, v]) => v > 0);
  if (entries.length === 0) return formatMoney(0, fallbackCurrency);
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([cur, v]) => formatMoney(v, cur))
    .join(" · ");
}
