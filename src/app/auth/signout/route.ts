import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Signs the user out (the app nav posts a form here) and returns them to the landing page. */
export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Fall through: we still send the user home.
    }
  }
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
