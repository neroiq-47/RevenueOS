import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Privileged client that bypasses RLS. Use ONLY in the Stripe webhook, where no user
 * session exists. Never import this from a Server Component that renders user data.
 */
export function createAdminClient() {
  return createClient<Database>(serverEnv.supabaseUrl(), serverEnv.supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
