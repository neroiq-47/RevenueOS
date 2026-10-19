import "server-only";
import { NextResponse } from "next/server";
import { getOrgContext, type OrgContext } from "@/lib/org";

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * For API routes behind the paywall. Returns the org context, or a response to send back
 * (401 when signed out, 402 when the organisation has no active subscription).
 */
export async function requireEntitledApi(): Promise<{ ctx: OrgContext } | { response: NextResponse }> {
  const ctx = await getOrgContext();
  if (!ctx) return { response: jsonError("Not signed in", 401) };
  if (!ctx.entitled) return { response: jsonError("An active subscription is required", 402) };
  return { ctx };
}

/** Rejects cross-site form/JSON posts. Same-origin fetches send a matching Origin header. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
