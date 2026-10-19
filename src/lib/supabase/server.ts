import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/** Supabase client bound to the signed-in user's session. All queries are subject to RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}
