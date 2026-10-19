import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let client: Stripe | null = null;

/** Lazily constructed Stripe client (server only). Uses the SDK's pinned API version. */
export function getStripe(): Stripe {
  if (!client) {
    client = new Stripe(serverEnv.stripeSecretKey(), {
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: "RevenueOS Lite" },
    });
  }
  return client;
}

/** Creates a Stripe billing portal session for a customer and returns its URL. */
export async function createPortalUrl(customerId: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${serverEnv.siteUrl()}/app/billing`,
  });
  return session.url;
}

/** Shape written to public.subscriptions (minus organization_id / updated_at). */
export type SubscriptionRow = {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string | null;
};

/** DB/Stripe access used by the webhook handler, injected so the handler is unit-testable. */
export type StripeEventDeps = {
  upsertSubscription(orgId: string, row: SubscriptionRow): Promise<void>;
  findOrgIdByCustomer(customerId: string): Promise<string | null>;
  /** The subscription currently stored for an org, used to ignore stale events for an old subscription. */
  getStoredSubscription(orgId: string): Promise<{ stripe_subscription_id: string | null; status: string } | null>;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
};

export type HandleResult =
  | { handled: true; orgId: string; status: string }
  | { handled: false; reason: "ignored_event_type" | "unknown_org" | "no_subscription" | "stale_subscription" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asOrgId(value: string | null | undefined): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Maps a Stripe subscription to our row. Period end lives on subscription items (API 2025+). Pure. */
export function subscriptionToRow(sub: Stripe.Subscription): SubscriptionRow {
  const ends = (sub.items?.data ?? [])
    .map((item) => item.current_period_end)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const periodEnd = ends.length ? Math.max(...ends) : null;
  return {
    stripe_customer_id: idOf(sub.customer) ?? "",
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEnd === null ? null : new Date(periodEnd * 1000).toISOString(),
  };
}

const ENTITLED_STATUSES = new Set(["active", "trialing"]);

async function resolveOrgId(
  deps: StripeEventDeps,
  sub: Stripe.Subscription,
  preferred?: string | null,
): Promise<string | null> {
  const direct = asOrgId(preferred) ?? asOrgId(sub.metadata?.organization_id);
  if (direct) return direct;
  const customerId = idOf(sub.customer);
  return customerId ? asOrgId(await deps.findOrgIdByCustomer(customerId)) : null;
}

async function sync(
  deps: StripeEventDeps,
  sub: Stripe.Subscription,
  preferredOrgId?: string | null,
): Promise<HandleResult> {
  const orgId = await resolveOrgId(deps, sub, preferredOrgId);
  if (!orgId) return { handled: false, reason: "unknown_org" };
  const row = subscriptionToRow(sub);

  // An org has one subscription row. Don't let a late event about an older, ended subscription
  // overwrite a different subscription that currently grants access.
  const stored = await deps.getStoredSubscription(orgId);
  if (
    stored?.stripe_subscription_id &&
    stored.stripe_subscription_id !== row.stripe_subscription_id &&
    ENTITLED_STATUSES.has(stored.status) &&
    !ENTITLED_STATUSES.has(row.status)
  ) {
    return { handled: false, reason: "stale_subscription" };
  }

  await deps.upsertSubscription(orgId, row);
  return { handled: true, orgId, status: row.status };
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return idOf(invoice.parent?.subscription_details?.subscription ?? null);
}

/**
 * Applies a verified Stripe event to our subscription state. Throws on DB/Stripe errors so the
 * webhook returns 500 and Stripe retries. Subscriptions are re-fetched from Stripe where possible
 * so out-of-order deliveries still converge on the latest state.
 */
export async function handleStripeEvent(event: Stripe.Event, deps: StripeEventDeps): Promise<HandleResult> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return { handled: false, reason: "ignored_event_type" };
      const subId = idOf(session.subscription);
      if (!subId) return { handled: false, reason: "no_subscription" };
      const sub = await deps.retrieveSubscription(subId);
      const orgId = asOrgId(session.client_reference_id) ?? asOrgId(session.metadata?.organization_id);
      return sync(deps, sub, orgId);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = await deps.retrieveSubscription(event.data.object.id);
      return sync(deps, sub);
    }
    case "customer.subscription.deleted": {
      // The payload is the final state (status "canceled").
      return sync(deps, event.data.object);
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const subId = invoiceSubscriptionId(event.data.object);
      if (!subId) return { handled: false, reason: "no_subscription" };
      const sub = await deps.retrieveSubscription(subId);
      return sync(deps, sub);
    }
    default:
      return { handled: false, reason: "ignored_event_type" };
  }
}
