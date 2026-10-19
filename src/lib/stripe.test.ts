import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { handleStripeEvent, subscriptionToRow, type StripeEventDeps, type SubscriptionRow } from "@/lib/stripe";
import { isEntitled } from "@/lib/org";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const FUTURE = Math.floor(Date.UTC(2099, 0, 1) / 1000);

function makeSub(overrides: Partial<Stripe.Subscription> & { periodEnds?: number[] } = {}): Stripe.Subscription {
  const { periodEnds = [FUTURE], ...rest } = overrides;
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    metadata: { organization_id: ORG },
    items: {
      object: "list",
      data: periodEnds.map((end, i) => ({ id: `si_${i}`, current_period_end: end })),
      has_more: false,
      url: "",
    },
    ...rest,
  } as unknown as Stripe.Subscription;
}

function event<T extends Stripe.Event["type"]>(type: T, object: unknown): Stripe.Event {
  return { id: "evt_1", object: "event", type, data: { object } } as unknown as Stripe.Event;
}

type Store = Map<string, SubscriptionRow>;

function makeDeps(sub: Stripe.Subscription, opts: { customerOrg?: string | null; store?: Store } = {}) {
  const store: Store = opts.store ?? new Map();
  const deps = {
    upsertSubscription: vi.fn(async (orgId: string, row: SubscriptionRow) => {
      store.set(orgId, row);
    }),
    findOrgIdByCustomer: vi.fn(async () => opts.customerOrg ?? null),
    getStoredSubscription: vi.fn(async (orgId: string) => store.get(orgId) ?? null),
    retrieveSubscription: vi.fn(async () => sub),
  } satisfies StripeEventDeps;
  return { deps, store };
}

describe("subscriptionToRow", () => {
  it("maps ids, status and period end from items", () => {
    const row = subscriptionToRow(makeSub());
    expect(row).toEqual({
      stripe_customer_id: "cus_123",
      stripe_subscription_id: "sub_123",
      status: "active",
      current_period_end: "2099-01-01T00:00:00.000Z",
    });
  });

  it("uses the latest item period end and expanded customer objects", () => {
    const row = subscriptionToRow(
      makeSub({ periodEnds: [1_700_000_000, FUTURE], customer: { id: "cus_obj" } as Stripe.Customer }),
    );
    expect(row.current_period_end).toBe("2099-01-01T00:00:00.000Z");
    expect(row.stripe_customer_id).toBe("cus_obj");
  });

  it("returns null period end when there are no items", () => {
    expect(subscriptionToRow(makeSub({ periodEnds: [] })).current_period_end).toBeNull();
  });

  it.each(["canceled", "past_due", "unpaid", "incomplete", "incomplete_expired", "paused"] as const)(
    "status %s maps through and is not entitled",
    (status) => {
      const row = subscriptionToRow(makeSub({ status }));
      expect(row.status).toBe(status);
      expect(isEntitled(row)).toBe(false);
    },
  );

  it.each(["active", "trialing"] as const)("status %s with a future period is entitled", (status) => {
    expect(isEntitled(subscriptionToRow(makeSub({ status })))).toBe(true);
  });

  it("an active subscription whose period has ended is not entitled", () => {
    expect(isEntitled(subscriptionToRow(makeSub({ periodEnds: [1_600_000_000] })))).toBe(false);
  });
});

describe("handleStripeEvent", () => {
  let sub: Stripe.Subscription;
  beforeEach(() => {
    sub = makeSub({ metadata: {} });
  });

  it("checkout.session.completed uses client_reference_id and retrieves the subscription", async () => {
    const { deps, store } = makeDeps(sub);
    const res = await handleStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        subscription: "sub_123",
        client_reference_id: ORG,
        metadata: {},
      }),
      deps,
    );
    expect(res).toEqual({ handled: true, orgId: ORG, status: "active" });
    expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(store.get(ORG)?.stripe_subscription_id).toBe("sub_123");
  });

  it("checkout.session.completed falls back to metadata.organization_id", async () => {
    const { deps } = makeDeps(sub);
    const res = await handleStripeEvent(
      event("checkout.session.completed", {
        mode: "subscription",
        subscription: { id: "sub_123" },
        client_reference_id: null,
        metadata: { organization_id: ORG },
      }),
      deps,
    );
    expect(res).toMatchObject({ handled: true, orgId: ORG });
  });

  it("ignores non-subscription checkout sessions", async () => {
    const { deps } = makeDeps(sub);
    const res = await handleStripeEvent(event("checkout.session.completed", { mode: "payment" }), deps);
    expect(res).toEqual({ handled: false, reason: "ignored_event_type" });
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it.each(["customer.subscription.created", "customer.subscription.updated"] as const)(
    "%s re-fetches and uses subscription metadata",
    async (type) => {
      const fresh = makeSub({ status: "past_due" });
      const { deps, store } = makeDeps(fresh);
      const res = await handleStripeEvent(event(type, makeSub({ status: "active" })), deps);
      expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_123");
      expect(res).toEqual({ handled: true, orgId: ORG, status: "past_due" });
      expect(isEntitled(store.get(ORG)!)).toBe(false);
    },
  );

  it("customer.subscription.updated falls back to customer lookup", async () => {
    const { deps } = makeDeps(sub, { customerOrg: OTHER_ORG });
    const res = await handleStripeEvent(event("customer.subscription.updated", sub), deps);
    expect(deps.findOrgIdByCustomer).toHaveBeenCalledWith("cus_123");
    expect(res).toMatchObject({ handled: true, orgId: OTHER_ORG });
  });

  it("customer.subscription.deleted stores canceled status from the payload", async () => {
    const deleted = makeSub({ status: "canceled" });
    const { deps, store } = makeDeps(deleted);
    const res = await handleStripeEvent(event("customer.subscription.deleted", deleted), deps);
    expect(deps.retrieveSubscription).not.toHaveBeenCalled();
    expect(res).toMatchObject({ handled: true, status: "canceled" });
    expect(isEntitled(store.get(ORG)!)).toBe(false);
  });

  it.each([
    ["invoice.paid", "active", true],
    ["invoice.payment_failed", "past_due", false],
  ] as const)("%s retrieves the subscription and upserts", async (type, status, entitled) => {
    const fresh = makeSub({ status });
    const { deps, store } = makeDeps(fresh);
    const res = await handleStripeEvent(
      event(type, { parent: { type: "subscription_details", subscription_details: { subscription: "sub_123" } } }),
      deps,
    );
    expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(res).toMatchObject({ handled: true, status });
    expect(isEntitled(store.get(ORG)!)).toBe(entitled);
  });

  it("ignores invoices without a subscription", async () => {
    const { deps } = makeDeps(sub);
    const res = await handleStripeEvent(event("invoice.paid", { parent: null }), deps);
    expect(res).toEqual({ handled: false, reason: "no_subscription" });
  });

  it("returns unknown_org when no org can be resolved", async () => {
    const { deps } = makeDeps(sub, { customerOrg: null });
    const res = await handleStripeEvent(event("customer.subscription.updated", sub), deps);
    expect(res).toEqual({ handled: false, reason: "unknown_org" });
    expect(deps.upsertSubscription).not.toHaveBeenCalled();
  });

  it("rejects malformed org ids in metadata", async () => {
    const bad = makeSub({ metadata: { organization_id: "not-a-uuid" } });
    const { deps } = makeDeps(bad, { customerOrg: null });
    const res = await handleStripeEvent(event("customer.subscription.updated", bad), deps);
    expect(res).toEqual({ handled: false, reason: "unknown_org" });
  });

  it("does not let a stale ended subscription overwrite a different active one", async () => {
    const store: Store = new Map([
      [ORG, { stripe_customer_id: "cus_123", stripe_subscription_id: "sub_new", status: "active", current_period_end: null }],
    ]);
    const old = makeSub({ id: "sub_old", status: "canceled" });
    const { deps } = makeDeps(old, { store });
    const res = await handleStripeEvent(event("customer.subscription.deleted", old), deps);
    expect(res).toEqual({ handled: false, reason: "stale_subscription" });
    expect(store.get(ORG)?.stripe_subscription_id).toBe("sub_new");
  });

  it("ignores unrelated event types", async () => {
    const { deps } = makeDeps(sub);
    const res = await handleStripeEvent(event("customer.created", {}), deps);
    expect(res).toEqual({ handled: false, reason: "ignored_event_type" });
  });

  it("propagates DB errors so the webhook can return 500", async () => {
    const { deps } = makeDeps(makeSub());
    deps.upsertSubscription.mockRejectedValueOnce(new Error("db down"));
    await expect(handleStripeEvent(event("customer.subscription.updated", makeSub()), deps)).rejects.toThrow("db down");
  });
});
