import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MAX_CSV_BYTES, MAX_ERRORS, MAX_ROWS, parseAmountToCents, parseActivityDate, parseOpportunitiesCsv } from "./csv";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const HEADER = "title,contact_name,contact_email,amount,last_activity_at,currency,stage";

describe("parseOpportunitiesCsv", () => {
  it("parses a good file", () => {
    const csv = [
      HEADER,
      'Website redesign,Ana Ruiz,Ana@Example.com,"$12,500.00",2026-10-01,usd,open',
      "SEO retainer,Ben Ito,ben@example.co.uk,4800,2026-09-15T09:30:00Z,EUR,Won",
      "Audit,Cy Moe,cy@example.org,0,2026-10-18 08:00,,",
    ].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors).toEqual([]);
    expect(r.missingHeaders).toEqual([]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toEqual({
      title: "Website redesign",
      contact_name: "Ana Ruiz",
      contact_email: "ana@example.com",
      amount_cents: 1_250_000,
      currency: "USD",
      stage: "open",
      last_activity_at: "2026-10-01T00:00:00.000Z",
    });
    expect(r.rows[1]).toMatchObject({ currency: "EUR", stage: "won", amount_cents: 480_000 });
    expect(r.rows[2]).toMatchObject({ currency: "USD", stage: "open", amount_cents: 0, last_activity_at: "2026-10-18T08:00:00.000Z" });
  });

  it("parses the bundled sample file without errors", () => {
    const text = readFileSync(path.resolve(__dirname, "../../public/sample-opportunities.csv"), "utf8");
    const r = parseOpportunitiesCsv(text, NOW);
    expect(r.errors).toEqual([]);
    expect(r.rows.length).toBeGreaterThanOrEqual(12);
  });

  it("reports missing headers", () => {
    const r = parseOpportunitiesCsv("title,email\nFoo,a@b.co", NOW);
    expect(r.missingHeaders).toEqual(["contact_name", "amount", "last_activity_at"]);
    expect(r.rows).toEqual([]);
  });

  it("treats an empty file as missing all headers", () => {
    expect(parseOpportunitiesCsv("", NOW).missingHeaders).toHaveLength(5);
  });

  it("accepts header aliases, case and whitespace", () => {
    const csv = "﻿ Deal ,Contact,E-mail Address,Value,Last Activity,Status\nRebrand,Dee,dee@acme.io,1000,2026-10-02,lost";
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.missingHeaders).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toMatchObject({ title: "Rebrand", contact_name: "Dee", contact_email: "dee@acme.io", stage: "lost" });
  });

  it("accepts 'quote' and 'email' aliases", () => {
    const r = parseOpportunitiesCsv("quote,name,email,amount,last_activity_at\nQ-1,Eve,eve@x.io,5,2026-10-02", NOW);
    expect(r.errors).toEqual([]);
    expect(r.rows[0].title).toBe("Q-1");
  });

  it("flags duplicate columns mapping to the same field", () => {
    const r = parseOpportunitiesCsv("title,deal,contact_name,contact_email,amount,last_activity_at\nA,B,C,c@d.io,1,2026-10-01", NOW);
    expect(r.errors[0]).toMatchObject({ row: 0, field: "deal" });
  });

  it("rejects a bad email with the row number", () => {
    const csv = [HEADER, "A,Ann,ann@example.com,1,2026-10-01,,", "B,Bob,not-an-email,1,2026-10-01,,"].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ row: 2, field: "contact_email" });
    expect(r.rows).toHaveLength(1);
  });

  it("rejects bad and negative amounts", () => {
    const csv = [HEADER, "A,Ann,a@x.io,abc,2026-10-01,,", "B,Bob,b@x.io,-50,2026-10-01,,", "C,Cy,c@x.io,1.234,2026-10-01,,"].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([
      [1, "amount"],
      [2, "amount"],
      [3, "amount"],
    ]);
    expect(r.errors[1].message).toMatch(/negative/);
  });

  it("rejects future dates but allows small clock skew", () => {
    const csv = [
      HEADER,
      "A,Ann,a@x.io,1,2026-11-01,,",
      "B,Bob,b@x.io,1,2026-10-20,,", // tomorrow (date-only) is within timezone skew
      "C,Cy,c@x.io,1,2026-10-19T12:05:00Z,,", // 5 minutes ahead
      "D,Di,d@x.io,1,2026-10-19T14:00:00Z,,", // 2 hours ahead
    ].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors.map((e) => [e.row, e.field])).toEqual([
      [1, "last_activity_at"],
      [4, "last_activity_at"],
    ]);
  });

  it("rejects invalid dates", () => {
    const csv = [HEADER, "A,Ann,a@x.io,1,2026-02-31,,", "B,Bob,b@x.io,1,yesterday,,"].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors).toHaveLength(2);
    expect(r.errors.every((e) => e.field === "last_activity_at")).toBe(true);
  });

  it("validates currency, stage and lengths", () => {
    const long = "x".repeat(201);
    const csv = [HEADER, `${long},Ann,a@x.io,1,2026-10-01,US,pending`].join("\n");
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors.map((e) => e.field).sort()).toEqual(["currency", "stage", "title"]);
  });

  it("requires values in required columns", () => {
    const r = parseOpportunitiesCsv([HEADER, " ,  ,a@x.io,1,2026-10-01,,"].join("\n"), NOW);
    expect(r.errors.map((e) => e.field)).toEqual(["title", "contact_name"]);
  });

  it("reports rows with the wrong number of columns", () => {
    const r = parseOpportunitiesCsv([HEADER, "A,Ann,a@x.io"].join("\n"), NOW);
    expect(r.errors[0]).toMatchObject({ row: 1, field: "row" });
  });

  it("enforces the row limit", () => {
    const lines = [HEADER];
    for (let i = 0; i < MAX_ROWS + 1; i++) lines.push(`Deal ${i},N,n${i}@x.io,1,2026-10-01,,`);
    const r = parseOpportunitiesCsv(lines.join("\n"), NOW);
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatchObject({ row: 0, field: "file" });
    expect(r.errors[0].message).toMatch(/1000/);
  });

  it("accepts exactly MAX_ROWS rows", () => {
    const lines = [HEADER];
    for (let i = 0; i < MAX_ROWS; i++) lines.push(`Deal ${i},N,n${i}@x.io,1,2026-10-01,,`);
    expect(parseOpportunitiesCsv(lines.join("\n"), NOW).rows).toHaveLength(MAX_ROWS);
  });

  it("enforces the byte limit", () => {
    const r = parseOpportunitiesCsv(HEADER + "\n" + "a".repeat(MAX_CSV_BYTES), NOW);
    expect(r.errors[0]).toMatchObject({ row: 0, field: "file" });
  });

  it("caps the error list but counts every error", () => {
    const lines = [HEADER];
    for (let i = 0; i < 80; i++) lines.push(`Deal ${i},N,bad-email,1,2026-10-01,,`);
    const r = parseOpportunitiesCsv(lines.join("\n"), NOW);
    expect(r.errors).toHaveLength(MAX_ERRORS);
    expect(r.errorCount).toBe(80);
  });

  it("skips blank lines and ignores unknown columns", () => {
    const csv = `${HEADER},notes\n\nA,Ann,a@x.io,1,2026-10-01,,,hello\n\n`;
    const r = parseOpportunitiesCsv(csv, NOW);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });
});

describe("parseAmountToCents", () => {
  it.each([
    ["1234", 123_400],
    ["$1,234.50", 123_450],
    ["1,234.5", 123_450],
    ["€99", 9_900],
    ["USD 10", 1_000],
    ["10.00 EUR", 1_000],
    ["0", 0],
  ])("%s → %d", (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });
  it.each(["", "-1", "1,23", "1.234", "abc", "1e5", "12,34,567"])("rejects %s", (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});

describe("parseActivityDate", () => {
  it("parses date-only as UTC midnight", () => {
    expect(parseActivityDate("2026-10-05")?.date.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("honours explicit offsets", () => {
    expect(parseActivityDate("2026-10-05T10:00:00+02:00")?.date.toISOString()).toBe("2026-10-05T08:00:00.000Z");
  });
  it("rejects impossible times", () => {
    expect(parseActivityDate("2026-10-05T25:00")).toBeNull();
  });
});
