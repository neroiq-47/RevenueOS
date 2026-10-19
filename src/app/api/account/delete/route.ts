import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getOrgContext } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ confirm: z.literal("DELETE") });

/**
 * POST { confirm: "DELETE" }: deletes the organisation's drafts, opportunities and contacts.
 * RLS lets the owner delete even without a subscription. Billing and the account itself are kept.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const ctx = await getOrgContext();
  if (!ctx) return jsonError("Not signed in", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  if (!Body.safeParse(body).success) return jsonError('Type "DELETE" to confirm.', 400);

  const orgId = ctx.org.id;
  const db = ctx.supabase;

  // Children first so nothing is left dangling between steps.
  const drafts = await db.from("drafts").delete({ count: "exact" }).eq("organization_id", orgId);
  if (drafts.error) return failed(orgId, "drafts", drafts.error.code);
  const opportunities = await db.from("opportunities").delete({ count: "exact" }).eq("organization_id", orgId);
  if (opportunities.error) return failed(orgId, "opportunities", opportunities.error.code);
  const contacts = await db.from("contacts").delete({ count: "exact" }).eq("organization_id", orgId);
  if (contacts.error) return failed(orgId, "contacts", contacts.error.code);

  return NextResponse.json({
    deleted: {
      drafts: drafts.count ?? 0,
      opportunities: opportunities.count ?? 0,
      contacts: contacts.count ?? 0,
    },
  });
}

function failed(orgId: string, table: string, code?: string) {
  console.error("account.delete: failed", { org: orgId, table, code });
  return jsonError("Could not delete all data. Please try again.", 500);
}
