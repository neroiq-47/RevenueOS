import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/components/auth/safe-next";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function fail(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

/**
 * Email-link landing route. Supports both the token_hash flow (verifyOtp) and the
 * PKCE code flow (exchangeCodeForSession), then redirects to a sanitised `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  const providerError = searchParams.get("error_description") || searchParams.get("error");
  if (providerError) return fail(request, providerError);

  if (!isSupabaseConfigured()) return fail(request, "Authentication isn’t configured.");

  try {
    const supabase = await createClient();

    if (tokenHash && type) {
      if (!OTP_TYPES.includes(type as EmailOtpType)) return fail(request, "Invalid confirmation link.");
      const { error } = await supabase.auth.verifyOtp({ type: type as EmailOtpType, token_hash: tokenHash });
      if (error) return fail(request, error.message);
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return fail(request, error.message);
      return NextResponse.redirect(new URL(next, request.url));
    }
  } catch {
    return fail(request, "We couldn’t verify that link. Please try again.");
  }

  return fail(request, "That link is invalid or has expired.");
}
