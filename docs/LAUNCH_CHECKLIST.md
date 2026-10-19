# Launch acceptance checklist

| Check | How it is covered |
| --- | --- |
| ☐ Sign-up and verified login work | Supabase email confirmation → `/auth/confirm`; test manually on the preview URL |
| ☐ Unpaid user cannot access paid functionality | `requireEntitledOrg` / `requireEntitledApi` redirect or return 402; RLS blocks writes without a subscription |
| ☐ Customer A cannot view or modify Customer B data | `supabase/tests/rls_cross_tenant.sql` |
| ☐ Invalid CSV data is rejected with helpful errors | `src/lib/csv.test.ts`; import is all-or-nothing with row/field errors |
| ☐ Stale opportunity logic passes sample tests | `src/lib/stale.test.ts` |
| ☐ Draft generation is safe, bounded and rate-limited | `src/lib/ai.test.ts`; per-minute and monthly limits in `/api/drafts` |
| ☐ Stripe purchase, cancellation and duplicate webhooks tested | `src/lib/stripe.test.ts` + Stripe CLI replays against a test-mode deployment |
| ☐ Privacy, deletion, error logging and backups documented | `/privacy`, `docs/OPERATIONS.md` |
| ☐ First pilot customer completes onboarding unaided | Watch one real onboarding session |
