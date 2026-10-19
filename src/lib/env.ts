import "server-only";

/**
 * Server-side environment access. Values are read lazily so the app can build
 * (and the marketing pages can render) without every secret configured.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const serverEnv = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: () => required("SUPABASE_SECRET_KEY"),
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiModel: () => process.env.OPENAI_MODEL || "gpt-4o-mini",
  stripeSecretKey: () => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET"),
  stripePriceId: () => required("STRIPE_PRICE_ID"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  aiDraftsPerMonth: () => Number(process.env.AI_DRAFTS_PER_MONTH || 100),
  staleDays: () => Number(process.env.STALE_DAYS || 7),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
