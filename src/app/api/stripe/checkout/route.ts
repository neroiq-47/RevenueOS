import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getOrgContext } from "@/lib/org";
import { createPortalUrl, getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

/** Form POST from /app/billing: starts a hosted Stripe Checkout for the $499/month plan. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const ctx = await getOrgContext();
  if (!ctx) return redirectTo(request, "/login");

  const customerId = ctx.subscription?.stripe_customer_id ?? null;
  const status = ctx.subscription?.status;

  try {
    // Already paying (or needing to fix a failed payment): manage the existing subscription instead
    // of creating a second one.
    if (customerId && (ctx.entitled || status === "past_due" || status === "unpaid")) {
      return NextResponse.redirect(await createPortalUrl(customerId), 303);
    }

    const siteUrl = serverEnv.siteUrl();
    const metadata = { organization_id: ctx.org.id };
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: serverEnv.stripePriceId(), quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: ctx.email || undefined }),
      client_reference_id: ctx.org.id,
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
      success_url: `${siteUrl}/app/billing?status=success`,
      cancel_url: `${siteUrl}/app/billing?status=cancelled`,
    });
    if (!session.url) throw new Error("Checkout session has no URL");
    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error("stripe.checkout: failed", { org: ctx.org.id, error: err instanceof Error ? err.message : "unknown" });
    return redirectTo(request, "/app/billing?status=error");
  }
}
