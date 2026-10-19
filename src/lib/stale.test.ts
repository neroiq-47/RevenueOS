import { describe, expect, it } from "vitest";
import {
  daysInactive,
  formatMoney,
  formatTotals,
  getStaleOpportunities,
  isStale,
  sortStale,
  summarize,
  type StaleInput,
} from "./stale";

const NOW = new Date("2026-10-19T12:00:00.000Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function opp(partial: Partial<StaleInput> & { id: string }): StaleInput & { id: string } {
  return { stage: "open", amount_cents: 100_00, currency: "USD", last_activity_at: ago(10), ...partial };
}

describe("daysInactive", () => {
  it("returns fractional days", () => {
    expect(daysInactive(ago(3.5), NOW)).toBeCloseTo(3.5, 6);
  });
  it("clamps future dates to 0", () => {
    expect(daysInactive(ago(-2), NOW)).toBe(0);
  });
  it("returns NaN for unparseable dates", () => {
    expect(daysInactive("not a date", NOW)).toBeNaN();
  });
  it("accepts Date objects", () => {
    expect(daysInactive(new Date(NOW.getTime() - 2 * DAY), NOW)).toBe(2);
  });
});

describe("isStale", () => {
  it("is stale at exactly 7 days", () => {
    expect(isStale(opp({ id: "a", last_activity_at: ago(7) }), NOW)).toBe(true);
  });
  it("is not stale at 6.99 days", () => {
    expect(isStale(opp({ id: "a", last_activity_at: ago(6.99) }), NOW)).toBe(false);
  });
  it("is not stale one millisecond before the threshold", () => {
    const t = new Date(NOW.getTime() - 7 * DAY + 1).toISOString();
    expect(isStale(opp({ id: "a", last_activity_at: t }), NOW)).toBe(false);
  });
  it("never flags closed deals, however old", () => {
    expect(isStale(opp({ id: "w", stage: "won", last_activity_at: ago(400) }), NOW)).toBe(false);
    expect(isStale(opp({ id: "l", stage: "lost", last_activity_at: ago(400) }), NOW)).toBe(false);
  });
  it("respects a custom threshold", () => {
    const o = opp({ id: "a", last_activity_at: ago(10) });
    expect(isStale(o, NOW, 14)).toBe(false);
    expect(isStale(o, NOW, 10)).toBe(true);
  });
  it("falls back to 7 days for an invalid threshold", () => {
    expect(isStale(opp({ id: "a", last_activity_at: ago(7) }), NOW, Number.NaN)).toBe(true);
    expect(isStale(opp({ id: "a", last_activity_at: ago(6) }), NOW, -1)).toBe(false);
  });
  it("never flags invalid dates", () => {
    expect(isStale(opp({ id: "a", last_activity_at: "garbage" }), NOW)).toBe(false);
  });
});

describe("sortStale", () => {
  it("sorts by amount descending", () => {
    const sorted = sortStale([
      opp({ id: "small", amount_cents: 1_000 }),
      opp({ id: "big", amount_cents: 9_000 }),
      opp({ id: "mid", amount_cents: 5_000 }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["big", "mid", "small"]);
  });
  it("breaks amount ties by inactivity, oldest first", () => {
    const sorted = sortStale([
      opp({ id: "recent", amount_cents: 5_000, last_activity_at: ago(8) }),
      opp({ id: "oldest", amount_cents: 5_000, last_activity_at: ago(30) }),
      opp({ id: "older", amount_cents: 5_000, last_activity_at: ago(15) }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["oldest", "older", "recent"]);
  });
  it("breaks full ties by id for a deterministic order", () => {
    const t = ago(9);
    const sorted = sortStale([
      opp({ id: "b", last_activity_at: t }),
      opp({ id: "a", last_activity_at: t }),
    ]);
    expect(sorted.map((o) => o.id)).toEqual(["a", "b"]);
  });
  it("does not mutate its input", () => {
    const input = [opp({ id: "a", amount_cents: 1 }), opp({ id: "b", amount_cents: 2 })];
    sortStale(input);
    expect(input.map((o) => o.id)).toEqual(["a", "b"]);
  });
});

describe("getStaleOpportunities", () => {
  it("filters to stale open deals and sorts them", () => {
    const result = getStaleOpportunities(
      [
        opp({ id: "fresh", amount_cents: 99_999, last_activity_at: ago(1) }),
        opp({ id: "won", stage: "won", amount_cents: 99_999, last_activity_at: ago(60) }),
        opp({ id: "stale-small", amount_cents: 1_000, last_activity_at: ago(20) }),
        opp({ id: "stale-big", amount_cents: 50_000, last_activity_at: ago(7) }),
      ],
      NOW,
      7,
    );
    expect(result.map((o) => o.id)).toEqual(["stale-big", "stale-small"]);
  });
});

describe("summarize", () => {
  it("counts stages and totals value per currency", () => {
    const s = summarize(
      [
        opp({ id: "1", amount_cents: 10_000, last_activity_at: ago(1) }),
        opp({ id: "2", amount_cents: 20_000, last_activity_at: ago(9) }),
        opp({ id: "3", amount_cents: 5_000, currency: "EUR", last_activity_at: ago(30) }),
        opp({ id: "4", stage: "won", amount_cents: 70_000 }),
        opp({ id: "5", stage: "lost", amount_cents: 3_000 }),
      ],
      NOW,
    );
    expect(s.openCount).toBe(3);
    expect(s.staleCount).toBe(2);
    expect(s.wonCount).toBe(1);
    expect(s.lostCount).toBe(1);
    expect(s.openValue).toEqual({ USD: 30_000, EUR: 5_000 });
    expect(s.staleValue).toEqual({ USD: 20_000, EUR: 5_000 });
    expect(s.wonValue).toEqual({ USD: 70_000 });
    expect(s.primaryCurrency).toBe("USD");
    expect(s.openValueCents).toBe(30_000);
    expect(s.staleValueCents).toBe(20_000);
  });
  it("handles an empty pipeline", () => {
    const s = summarize([], NOW);
    expect(s).toMatchObject({ openCount: 0, staleCount: 0, wonCount: 0, lostCount: 0, primaryCurrency: "USD" });
    expect(s.openValueCents).toBe(0);
  });
});

describe("formatting", () => {
  it("formats cents as currency", () => {
    expect(formatMoney(123_450, "USD")).toBe("$1,234.50");
    expect(formatMoney(500_000, "USD")).toBe("$5,000");
  });
  it("formats totals largest first", () => {
    expect(formatTotals({ EUR: 100_00, USD: 500_00 })).toBe("$500 · €100");
    expect(formatTotals({})).toBe("$0");
  });
});
