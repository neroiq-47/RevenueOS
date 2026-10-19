import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { isSameOrigin, jsonError, requireEntitledApi } from "@/lib/http";
import { checkLimit, monthlyUsage, recordUsage } from "@/lib/usage";
import { AiGenerationError, AiNotConfiguredError, generateDraft, isAiConfigured } from "@/lib/ai";
import type { OrgContext } from "@/lib/org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBody = z.object({ opportunityId: z.string().uuid() });
const MS_PER_DAY = 86_400_000;

async function remainingDrafts(ctx: OrgContext): Promise<number | null> {
  try {
    return Math.max(0, serverEnv.aiDraftsPerMonth() - (await monthlyUsage(ctx, "draft")));
  } catch {
    return null;
  }
}

/** Latest draft for one opportunity in the caller's organisation (or null). */
export async function GET(request: Request) {
  const auth = await requireEntitledApi();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("opportunityId"));
  if (!parsed.success) return jsonError("A valid opportunityId is required", 400);

  const { data, error } = await ctx.supabase
    .from("drafts")
    .select("id, content, created_at")
    .eq("organization_id", ctx.org.id)
    .eq("opportunity_id", parsed.data)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("drafts.get: query failed", { code: error.code });
    return jsonError("Could not load the draft", 500);
  }

  return NextResponse.json(
    { draft: data ?? null, remaining: await remainingDrafts(ctx) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Generates a new follow-up draft for an opportunity. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const auth = await requireEntitledApi();
  if ("response" in auth) return auth.response;
  const { ctx } = auth;

  if (!isAiConfigured()) return jsonError("AI drafts are not available right now.", 503);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const parsed = PostBody.safeParse(body);
  if (!parsed.success) return jsonError("A valid opportunityId is required", 400);
  const { opportunityId } = parsed.data;

  const limit = await checkLimit(ctx, "draft", { perMinute: 5, perMonth: serverEnv.aiDraftsPerMonth() });
  if (!limit.ok) return jsonError(limit.reason, limit.status);

  const { data: opp, error: oppError } = await ctx.supabase
    .from("opportunities")
    .select("id, title, amount_cents, currency, last_activity_at, contact_id")
    .eq("organization_id", ctx.org.id)
    .eq("id", opportunityId)
    .maybeSingle();
  if (oppError) {
    console.error("drafts.post: opportunity query failed", { code: oppError.code });
    return jsonError("Could not load the opportunity", 500);
  }
  if (!opp) return jsonError("Opportunity not found", 404);

  let contactName: string | null = null;
  if (opp.contact_id) {
    const { data: contact } = await ctx.supabase
      .from("contacts")
      .select("name")
      .eq("organization_id", ctx.org.id)
      .eq("id", opp.contact_id)
      .maybeSingle();
    contactName = contact?.name ?? null;
  }

  const lastActivity = new Date(opp.last_activity_at).getTime();
  const daysInactive = Number.isFinite(lastActivity) ? Math.max(0, Math.floor((Date.now() - lastActivity) / MS_PER_DAY)) : 0;

  let content: string;
  try {
    content = await generateDraft({
      title: opp.title,
      contactName,
      amountCents: opp.amount_cents,
      currency: opp.currency,
      daysInactive,
      orgName: ctx.org.name,
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return jsonError("AI drafts are not available right now.", 503);
    // Log only non-customer metadata.
    console.error("drafts.post: generation failed", {
      org: ctx.org.id,
      error: err instanceof AiGenerationError ? `${err.message} [${err.causeName ?? "-"}]` : "unexpected error",
    });
    return jsonError("The AI service couldn't write a draft right now. Please try again in a moment.", 502);
  }

  const { data: draft, error: insertError } = await ctx.supabase
    .from("drafts")
    .insert({ organization_id: ctx.org.id, opportunity_id: opp.id, content })
    .select("id, content, created_at")
    .single();
  if (insertError || !draft) {
    console.error("drafts.post: insert failed", { code: insertError?.code });
    return jsonError("Could not save the draft", 500);
  }

  try {
    await recordUsage(ctx, "draft");
  } catch (err) {
    console.error("drafts.post: usage record failed", { org: ctx.org.id, error: err instanceof Error ? err.name : "unknown" });
  }

  return NextResponse.json({ draft, remaining: await remainingDrafts(ctx) }, { headers: { "Cache-Control": "no-store" } });
}
