import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError, requireEntitledApi } from "@/lib/http";
import type { Database } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
  outcome: z.enum(["won", "lost", "followed_up", "reopen"]),
});

type OpportunityUpdate = Database["public"]["Tables"]["opportunities"]["Update"];

/** PATCH { outcome } — record a deal outcome or a follow-up. Scoped to the caller's organisation. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError("Cross-origin request rejected", 403);

  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Opportunity not found", 404);

  const auth = await requireEntitledApi();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Request body must be JSON", 400);
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("outcome must be one of: won, lost, followed_up, reopen", 400);
  }

  const now = new Date().toISOString();
  const updates: Record<z.infer<typeof BodySchema>["outcome"], OpportunityUpdate> = {
    won: { stage: "won" },
    lost: { stage: "lost" },
    // Logging a follow-up counts as activity, which resets the stale clock.
    // Only open deals can be followed up; closed deals must be reopened first.
    followed_up: { last_activity_at: now },
    reopen: { stage: "open" },
  };
  const update = updates[parsed.data.outcome];

  let query = ctx.supabase.from("opportunities").update(update).eq("id", id).eq("organization_id", ctx.org.id);
  if (parsed.data.outcome === "followed_up") query = query.eq("stage", "open");
  const { data, error } = await query.select("id, stage, last_activity_at");

  if (error) {
    console.error("opportunities PATCH failed", error.code);
    return jsonError("Could not update the opportunity", 500);
  }
  if (!data || data.length === 0) return jsonError("Open opportunity not found", 404);

  return NextResponse.json({ opportunity: data[0] });
}
