/**
 * Pure CSV parsing + validation for opportunity imports. No I/O: the API route reads the
 * upload, calls parseOpportunitiesCsv, and only writes to the database when there are no errors.
 */
import Papa from "papaparse";
import type { OpportunityStage } from "@/lib/database.types";

export const MAX_CSV_BYTES = 1024 * 1024; // 1 MB
export const MAX_ROWS = 1000;
export const MAX_ERRORS = 50;
/** Largest accepted amount: 1 billion in major units. Guards against typos and bigint overflow. */
export const MAX_AMOUNT_CENTS = 100_000_000_000;

export type CanonicalField =
  | "title"
  | "contact_name"
  | "contact_email"
  | "amount"
  | "last_activity_at"
  | "currency"
  | "stage";

export const REQUIRED_FIELDS = ["title", "contact_name", "contact_email", "amount", "last_activity_at"] as const;
export const OPTIONAL_FIELDS = ["currency", "stage"] as const;

/** Accepted header spellings (after normalisation: lowercase, spaces/dashes → underscores). */
export const HEADER_ALIASES: Record<CanonicalField, readonly string[]> = {
  title: ["title", "deal", "deal_name", "deal_title", "quote", "quote_name", "quote_title", "opportunity", "opportunity_name"],
  contact_name: ["contact_name", "contact", "name", "client_name", "customer_name", "contact_full_name"],
  contact_email: ["contact_email", "email", "e_mail", "email_address", "e_mail_address", "contact_email_address", "client_email", "customer_email"],
  amount: ["amount", "value", "deal_value", "quote_value", "deal_amount", "quote_amount", "total"],
  last_activity_at: [
    "last_activity_at",
    "last_activity",
    "last_activity_date",
    "last_contacted",
    "last_contact",
    "last_contact_date",
    "last_touch",
    "last_touched",
  ],
  currency: ["currency", "currency_code"],
  stage: ["stage", "status", "deal_stage"],
};

export type ValidRow = {
  title: string;
  contact_name: string;
  /** Lowercased. */
  contact_email: string;
  amount_cents: number;
  /** Uppercase ISO 4217 code. */
  currency: string;
  stage: OpportunityStage;
  /** ISO 8601 UTC timestamp. */
  last_activity_at: string;
};

export type RowError = {
  /** 1-based data row (header excluded); spreadsheet line = row + 1. 0 = file-level problem. */
  row: number;
  field: string;
  message: string;
};

export type ParseResult = {
  rows: ValidRow[];
  errors: RowError[];
  missingHeaders: string[];
  /** Total errors found; `errors` is capped at MAX_ERRORS. */
  errorCount: number;
};

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})?$/i;
/** Date-only values are read as UTC midnight, so allow a day for timezones ahead of UTC. */
const DATE_ONLY_SKEW_MS = 24 * 60 * 60 * 1000;
const DATETIME_SKEW_MS = 10 * 60 * 1000;
const MIN_YEAR = 1990;

export function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-.]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

const ALIAS_LOOKUP: Map<string, CanonicalField> = new Map(
  (Object.entries(HEADER_ALIASES) as [CanonicalField, readonly string[]][]).flatMap(([field, aliases]) =>
    aliases.map((a) => [a, field] as const),
  ),
);

/** Collapses internal whitespace (incl. newlines in quoted cells) and trims. */
function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** "$1,234.50" → 123450. Returns null when not a valid non-negative amount. */
export function parseAmountToCents(raw: string): number | null {
  const s = raw.replace(/\s/g, "").replace(/^(?:[A-Za-z]{3})?[$€£¥]?/, "").replace(/(?:[A-Za-z]{3})$/, "");
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Parses ISO dates ("2026-10-01", "2026-10-01T14:30", "2026-10-01 14:30:00Z"). Times without a zone are UTC. */
export function parseActivityDate(raw: string): { date: Date; dateOnly: boolean } | null {
  const d = DATE_ONLY_RE.exec(raw);
  if (d) {
    const [y, m, day] = [Number(d[1]), Number(d[2]), Number(d[3])];
    const date = new Date(Date.UTC(y, m - 1, day));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== day) return null;
    return { date, dateOnly: true };
  }
  const t = DATETIME_RE.exec(raw);
  if (t) {
    const [y, m, day] = [Number(t[1]), Number(t[2]), Number(t[3])];
    // Validate the calendar date separately (Date silently rolls 2026-02-31 over).
    const probe = new Date(Date.UTC(y, m - 1, day));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== day) return null;
    if (Number(t[4]) > 23 || Number(t[5]) > 59 || Number(t[6] ?? 0) > 59) return null;
    let iso = raw.replace(" ", "T");
    if (!t[7]) iso += "Z";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : { date, dateOnly: false };
  }
  return null;
}

const STAGE_ALIASES: Record<string, OpportunityStage> = {
  open: "open",
  won: "won",
  lost: "lost",
  closed_won: "won",
  closed_lost: "lost",
};

export function parseOpportunitiesCsv(text: string, now: Date = new Date()): ParseResult {
  const errors: RowError[] = [];
  let errorCount = 0;
  const push = (e: RowError) => {
    errorCount++;
    if (errors.length < MAX_ERRORS) errors.push(e);
  };
  const fail = (message: string): ParseResult => ({
    rows: [],
    errors: [{ row: 0, field: "file", message }],
    missingHeaders: [],
    errorCount: 1,
  });

  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) {
    return fail(`File is larger than ${MAX_CSV_BYTES / (1024 * 1024)} MB. Split it into smaller files.`);
  }
  if (text.replace(/^﻿/, "").trim() === "") {
    return { rows: [], errors: [], missingHeaders: [...REQUIRED_FIELDS], errorCount: 0 };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: normalizeHeader,
  });

  // Map each canonical field to the first matching source column.
  const headers = parsed.meta.fields ?? [];
  const columnFor = new Map<CanonicalField, string>();
  for (const h of headers) {
    const field = ALIAS_LOOKUP.get(h);
    if (!field) continue;
    if (columnFor.has(field)) {
      push({ row: 0, field: h, message: `Column "${h}" duplicates "${columnFor.get(field)}" (both map to ${field}). Keep only one.` });
      continue;
    }
    columnFor.set(field, h);
  }
  const missingHeaders = REQUIRED_FIELDS.filter((f) => !columnFor.has(f));
  if (missingHeaders.length > 0) {
    return { rows: [], errors, missingHeaders, errorCount };
  }

  const data = parsed.data;
  if (data.length === 0) {
    return fail("The file has a header row but no data rows.");
  }
  if (data.length > MAX_ROWS) {
    return fail(`The file has ${data.length} rows; the limit is ${MAX_ROWS} per import. Split it into smaller files.`);
  }

  // Structural problems reported by the parser (unbalanced quotes, wrong column count).
  const structural = new Set<number>();
  for (const e of parsed.errors) {
    if (typeof e.row !== "number") {
      push({ row: 0, field: "file", message: e.message });
      continue;
    }
    // Papa reports TooManyFields for trailing empty cells too; only extra *values* are a problem.
    if (e.code === "TooManyFields") {
      const extra = (data[e.row] as Record<string, unknown> | undefined)?.__parsed_extra;
      if (Array.isArray(extra) && extra.every((v) => clean(v) === "")) continue;
    }
    structural.add(e.row);
    const msg =
      e.code === "TooFewFields"
        ? "Row has fewer columns than the header."
        : e.code === "TooManyFields"
          ? "Row has more columns than the header (check for unquoted commas)."
          : e.message;
    push({ row: e.row + 1, field: "row", message: msg });
  }

  const get = (record: Record<string, string>, field: CanonicalField) => {
    const col = columnFor.get(field);
    return col ? clean(record[col]) : "";
  };

  const rows: ValidRow[] = [];
  data.forEach((record, index) => {
    const row = index + 1;
    if (structural.has(index)) return;
    let ok = true;
    const err = (field: CanonicalField, message: string) => {
      ok = false;
      push({ row, field, message });
    };

    const title = get(record, "title");
    if (!title) err("title", "Title is required.");
    else if (title.length > 200) err("title", `Title is ${title.length} characters; the maximum is 200.`);

    const contactName = get(record, "contact_name");
    if (!contactName) err("contact_name", "Contact name is required.");
    else if (contactName.length > 200) err("contact_name", `Contact name is ${contactName.length} characters; the maximum is 200.`);

    const email = get(record, "contact_email").toLowerCase();
    if (!email) err("contact_email", "Contact email is required.");
    else if (email.length > 320 || !EMAIL_RE.test(email)) err("contact_email", `"${truncate(email)}" is not a valid email address.`);

    const amountRaw = get(record, "amount");
    let amountCents = 0;
    if (!amountRaw) err("amount", "Amount is required (use 0 if unknown).");
    else {
      const cents = parseAmountToCents(amountRaw);
      if (cents === null) {
        err(
          "amount",
          amountRaw.trim().startsWith("-")
            ? "Amount cannot be negative."
            : `"${truncate(amountRaw)}" is not a valid amount. Use a number like 12500 or 12,500.00.`,
        );
      } else if (cents > MAX_AMOUNT_CENTS) err("amount", "Amount is unrealistically large. Check for a typo.");
      else amountCents = cents;
    }

    const dateRaw = get(record, "last_activity_at");
    let lastActivity = "";
    if (!dateRaw) err("last_activity_at", "Last activity date is required.");
    else {
      const parsedDate = parseActivityDate(dateRaw);
      if (!parsedDate) {
        err("last_activity_at", `"${truncate(dateRaw)}" is not a valid date. Use YYYY-MM-DD (e.g. 2026-10-05).`);
      } else {
        const skew = parsedDate.dateOnly ? DATE_ONLY_SKEW_MS : DATETIME_SKEW_MS;
        if (parsedDate.date.getTime() > now.getTime() + skew) err("last_activity_at", "Last activity date is in the future.");
        else if (parsedDate.date.getUTCFullYear() < MIN_YEAR) err("last_activity_at", `Dates before ${MIN_YEAR} are not accepted.`);
        else lastActivity = parsedDate.date.toISOString();
      }
    }

    const currencyRaw = get(record, "currency").toUpperCase();
    const currency = currencyRaw || "USD";
    if (!CURRENCY_RE.test(currency)) err("currency", `"${truncate(currencyRaw)}" is not a 3-letter currency code like USD or EUR.`);

    const stageRaw = normalizeHeader(get(record, "stage"));
    const stage: OpportunityStage | undefined = stageRaw ? STAGE_ALIASES[stageRaw] : "open";
    if (!stage) err("stage", `"${truncate(get(record, "stage"))}" is not a valid stage. Use open, won or lost.`);

    if (ok && stage) {
      rows.push({
        title,
        contact_name: contactName,
        contact_email: email,
        amount_cents: amountCents,
        currency,
        stage,
        last_activity_at: lastActivity,
      });
    }
  });

  return { rows, errors, missingHeaders: [], errorCount };
}

function truncate(s: string, max = 60): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
