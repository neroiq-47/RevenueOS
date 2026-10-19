import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getOrgContext } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE = 1000;

/** Reads every row by paging past PostgREST's default row cap. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { code?: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`export query failed (${error.code ?? "unknown"})`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** GET: downloads all of the organisation's data as JSON. Available to unpaid owners too. */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return jsonError("Not signed in", 401);
  const orgId = ctx.org.id;
  const db = ctx.supabase;

  try {
    const [contacts, opportunities, drafts] = await Promise.all([
      fetchAll((from, to) =>
        db.from("contacts").select("id, name, email, created_at").eq("organization_id", orgId).order("created_at").range(from, to),
      ),
      fetchAll((from, to) =>
        db
          .from("opportunities")
          .select("id, contact_id, title, amount_cents, currency, stage, last_activity_at, created_at")
          .eq("organization_id", orgId)
          .order("created_at")
          .range(from, to),
      ),
      fetchAll((from, to) =>
        db
          .from("drafts")
          .select("id, opportunity_id, content, created_at")
          .eq("organization_id", orgId)
          .order("created_at")
          .range(from, to),
      ),
    ]);

    const payload = {
      exported_at: new Date().toISOString(),
      organization: { id: ctx.org.id, name: ctx.org.name, created_at: ctx.org.created_at },
      owner_email: ctx.email,
      subscription: ctx.subscription
        ? { status: ctx.subscription.status, current_period_end: ctx.subscription.current_period_end }
        : null,
      contacts,
      opportunities,
      drafts,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="revenueos-export-${date}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("account.export: failed", { org: orgId, error: err instanceof Error ? err.message : "unknown" });
    return jsonError("Could not export your data. Please try again.", 500);
  }
}
