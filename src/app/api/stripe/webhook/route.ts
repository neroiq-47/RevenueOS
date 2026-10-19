import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, handleStripeEvent, type StripeEventDeps } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNIQUE_VIOLATION = "23505";

function adminDeps(admin: ReturnType<typeof createAdminClient>): StripeEventDeps {
  return {
    async upsertSubscription(orgId, row) {
      const { error } = await admin
        .from("subscriptions")
        .upsert({ organization_id: orgId, ...row, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
      if (error) throw new Error(`subscriptions upsert failed (${error.code})`);
    },
    async findOrgIdByCustomer(customerId) {
      const { data, error } = await admin
        .from("subscriptions")
        .select("organization_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (error) throw new Error(`subscriptions lookup failed (${error.code})`);
      return data?.organization_id ?? null;
    },
    async getStoredSubscription(orgId) {
      const { data, error } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id, status")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw new Error(`subscriptions read failed (${error.code})`);
      return data ?? null;
    },
    retrieveSubscription: (id) => getStripe().subscriptions.retrieve(id),
  };
}

/** Stripe webhook: verifies the signature, dedupes by event id, and syncs subscription state. */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, serverEnv.stripeWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: seen, error: seenError } = await admin
    .from("webhook_events")
    .select("stripe_event_id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();
  if (seenError) {
    console.error("stripe.webhook: dedupe lookup failed", { event: event.id, code: seenError.code });
    return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
  }
  if (seen) return NextResponse.json({ received: true, duplicate: true });

  try {
    const result = await handleStripeEvent(event, adminDeps(admin));
    if (!result.handled && result.reason === "unknown_org") {
      console.warn("stripe.webhook: no organisation for event", { event: event.id, type: event.type });
    }
  } catch (err) {
    // Not recorded, so Stripe's retry will process it again.
    console.error("stripe.webhook: handler failed", {
      event: event.id,
      type: event.type,
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  const { error: insertError } = await admin
    .from("webhook_events")
    .insert({ stripe_event_id: event.id, type: event.type });
  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    // The handler is idempotent, so a missed record only means a retry re-applies the same state.
    console.error("stripe.webhook: could not record event", { event: event.id, code: insertError.code });
  }

  return NextResponse.json({ received: true });
}
