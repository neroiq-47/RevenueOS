# Operations, security and data handling

Minimum controls for the pilot. Review this before any customer data is uploaded.

## Access control
- One owner per organisation, created automatically on sign-up.
- Every customer table has row level security. Owners can read and delete their own rows; inserts and updates also require an active subscription (`private.has_entitlement`). Subscriptions and webhook events are writable only by the service role.
- Paid pages and API routes check the subscription on the server before doing anything (`requireEntitledOrg`, `requireEntitledApi`).
- Cross-tenant test: `supabase/tests/rls_cross_tenant.sql`. Re-run after every schema change.

## Secrets
- Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL` reach the browser.
- `SUPABASE_SECRET_KEY` is used only in the Stripe webhook. Rotate it in Supabase if it is ever exposed.

## Stripe
- Webhook signatures are verified with `STRIPE_WEBHOOK_SECRET`; unsigned or tampered requests get a 400.
- Each event id is recorded in `webhook_events` after successful processing, so retries and duplicates are ignored. A failed handler returns 500 and Stripe retries.
- Test before launch: purchase, cancellation at period end, immediate cancellation, failed payment, and replaying the same event twice.

## Limits
- CSV import: 1 MB, 1,000 rows, all-or-nothing validation, 5 imports per minute and 200 per month per organisation.
- AI drafts: 5 per minute and 100 per month per organisation (`AI_DRAFTS_PER_MONTH`), output capped at 2,000 characters. Set a monthly spend limit in the OpenAI dashboard as well.

## Logging
- Server logs record error types and ids only, never uploaded rows, contact details or draft text.
- Vercel and Supabase logs are restricted to project members.

## Data export and deletion
- Owners can download all their data as JSON from **Account → Export my data**.
- Owners can delete all contacts, opportunities and drafts from **Account → Delete all opportunity data**.
- Full account closure (auth user + organisation + Stripe customer): on request to the privacy contact, cancel the Stripe subscription, then delete the user in Supabase Auth. The organisation and all its rows cascade.

## Backups and restore
- Supabase takes daily backups on paid plans; enable Point-in-Time Recovery before scaling past the pilot.
- Restore drill (do once before launch): restore a backup into a new project, run the migrations check, point a preview deployment at it and sign in as a test owner.
- Keep migrations in `supabase/migrations` as the source of truth for the schema.

## Not claimed
This build is not SOC 2 certified, not enterprise certified, and makes no production-readiness guarantee.
