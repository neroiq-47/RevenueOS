import { NextResponse } from "next/server";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getOrgContext } from "@/lib/org";
import { createPortalUrl } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Form POST from /app/billing: opens the Stripe billing portal for the org's customer. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("Forbidden", 403);

  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url), 303);

  const customerId = ctx.subscription?.stripe_customer_id;
  if (!customerId) return jsonError("No billing account found. Subscribe first.", 400);

  try {
    return NextResponse.redirect(await createPortalUrl(customerId), 303);
  } catch (err) {
    console.error("stripe.portal: failed", { org: ctx.org.id, error: err instanceof Error ? err.message : "unknown" });
    return NextResponse.redirect(new URL("/app/billing?status=error", request.url), 303);
  }
}
