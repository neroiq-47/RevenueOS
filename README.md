# RevenueOS Lite

Recover stalled revenue. Upload your open quotes as a CSV, see which deals have gone quiet, get an AI-drafted follow-up you approve and send yourself, and mark the outcome. **$499 per organisation per month.**

This is the 48-hour MVP described in the build outline: a narrow, self-service pilot. It is not production-certified; see [docs/OPERATIONS.md](docs/OPERATIONS.md) and the [launch checklist](docs/LAUNCH_CHECKLIST.md) before onboarding real customers.

## Stack

| Layer | Tech |
| --- | --- |
| App + hosting | Next.js 15 (App Router, TypeScript) on Cloudflare Workers (OpenNext) |
| Auth + data | Supabase Auth + Postgres with row level security on every customer table |
| AI | OpenAI, server-side only, length-bounded and capped at 100 drafts / org / month |
| Payments | Stripe hosted Checkout + billing portal, one $499/month price |
| Imports | Server-side CSV parsing and validation (1 MB, 1,000 rows) |

## User journey

Landing → Sign up / verify email → Subscribe ($499/month) → Upload CSV → View stale opportunities → Generate draft → Copy approved draft → Mark outcome.

Paid features (dashboard, import, drafts, outcomes) check the subscription on the server and again in the database (RLS insert/update policies require an active subscription).

## Stale-deal rule

An **open** opportunity is stale when `last_activity_at` is at least `STALE_DAYS` (default 7) days old. Stale deals are sorted by amount (highest first), then by inactivity (oldest first). Marking a deal "Followed up" resets its activity date.

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

1. **Supabase**: create a project, then run `supabase/migrations/*.sql` in order (SQL editor or `supabase db push`). In Auth → URL configuration, set the Site URL and add `http://localhost:3000/auth/confirm` (and your production URL) to redirect URLs.
2. **Stripe**: create a product with one recurring $499/month price and put its id in `STRIPE_PRICE_ID`. Enable the customer portal. Add a webhook endpoint at `/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. **OpenAI**: set `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`).

Secrets without the `NEXT_PUBLIC_` prefix stay on the server. `SUPABASE_SECRET_KEY` is used only by the Stripe webhook to write subscription state.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (stale rule, CSV validation, AI prompt bounds, Stripe webhook handling) |

Database isolation test: run [`supabase/tests/rls_cross_tenant.sql`](supabase/tests/rls_cross_tenant.sql) in the Supabase SQL editor. It creates two throwaway tenants, checks that neither can read or change the other's data and that an unpaid tenant cannot write, then rolls everything back. It ends with `RLS TESTS PASSED`.

## Deploy (Cloudflare Workers)

The app runs on Cloudflare Workers through the OpenNext adapter (`wrangler.jsonc`, `open-next.config.ts`).

1. In the Cloudflare dashboard: Workers & Pages → Create → Import a repository → `neroiq-47/RevenueOS`, branch `main`.
2. Build command: `npx opennextjs-cloudflare build`. Deploy command: `npx opennextjs-cloudflare deploy`.
3. **Build variables** (inlined into the browser bundle at build time): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
4. **Worker variables and secrets** (runtime): the same three public values, plus `STRIPE_PRICE_ID`, and as secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`.
5. Point the Stripe webhook and the Supabase auth redirect URL at the Worker's URL.

Local check: `npm run cf:preview` builds and serves the Worker on localhost (put secrets in `.dev.vars`).

## Project layout

```
src/app/            pages and API routes (landing, auth, /app dashboard, /api/*)
src/components/     shared UI (logo, marketing sections, draft panel)
src/lib/            domain logic: stale rule, CSV parsing, AI, Stripe, entitlement, rate limits
supabase/           SQL migrations and the RLS test
docs/               operations, privacy and launch checklist
```
