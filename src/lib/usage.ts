import "server-only";
import type { OrgContext } from "@/lib/org";
import type { UsageKind } from "@/lib/database.types";

export type LimitResult = { ok: true } | { ok: false; reason: string; status: number };

/** Counts usage events of a kind for the org since a point in time (RLS-scoped). */
async function countSince(ctx: OrgContext, kind: UsageKind, since: Date): Promise<number> {
  const { count, error } = await ctx.supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ctx.org.id)
    .eq("kind", kind)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export function startOfMonthUtc(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Enforces a short-window rate limit plus an optional monthly quota.
 * Backed by the usage_events table so it works across serverless instances.
 */
export async function checkLimit(
  ctx: OrgContext,
  kind: UsageKind,
  opts: { perMinute: number; perMonth?: number },
): Promise<LimitResult> {
  const minuteAgo = new Date(Date.now() - 60_000);
  if ((await countSince(ctx, kind, minuteAgo)) >= opts.perMinute) {
    return { ok: false, status: 429, reason: "Too many requests. Please wait a minute and try again." };
  }
  if (opts.perMonth !== undefined) {
    const used = await countSince(ctx, kind, startOfMonthUtc());
    if (used >= opts.perMonth) {
      return { ok: false, status: 429, reason: `Monthly limit of ${opts.perMonth} reached. It resets on the 1st.` };
    }
  }
  return { ok: true };
}

export async function recordUsage(ctx: OrgContext, kind: UsageKind): Promise<void> {
  const { error } = await ctx.supabase.from("usage_events").insert({ organization_id: ctx.org.id, kind });
  if (error) throw error;
}

export async function monthlyUsage(ctx: OrgContext, kind: UsageKind): Promise<number> {
  return countSince(ctx, kind, startOfMonthUtc());
}
