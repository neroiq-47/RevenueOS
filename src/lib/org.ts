import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Subscription } from "@/lib/database.types";

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string;
  org: Organization;
  subscription: Subscription | null;
  entitled: boolean;
};

/** True when a subscription grants access to paid features right now. */
export function isEntitled(sub: Pick<Subscription, "status" | "current_period_end"> | null, now = new Date()): boolean {
  if (!sub) return false;
  if (sub.status !== "active" && sub.status !== "trialing") return false;
  return !sub.current_period_end || new Date(sub.current_period_end) > now;
}

/**
 * Loads the signed-in user's organisation and subscription. Returns null when signed out.
 * Every query runs through the user's session, so RLS scopes it to their tenant.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let { data: org } = await supabase.from("organizations").select("*").eq("owner_user_id", user.id).maybeSingle();
  if (!org) {
    // The signup trigger normally creates this; retry once in case of replication lag.
    await new Promise((r) => setTimeout(r, 300));
    ({ data: org } = await supabase.from("organizations").select("*").eq("owner_user_id", user.id).maybeSingle());
  }
  if (!org) throw new Error("Organisation not found for user");

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("organization_id", org.id)
    .maybeSingle();

  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    org,
    subscription: subscription ?? null,
    entitled: isEntitled(subscription ?? null),
  };
}

/** For pages: redirect signed-out users to login. */
export async function requireOrg(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For pages behind the paywall: signed-out users go to login, unpaid users go to billing. */
export async function requireEntitledOrg(): Promise<OrgContext> {
  const ctx = await requireOrg();
  if (!ctx.entitled) redirect("/app/billing");
  return ctx;
}
