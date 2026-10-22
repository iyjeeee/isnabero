# Integration tests (real database)

Runs the app's real Supabase repositories (catalog, POS, inventory, expenses, cash close, booking, scheduling, employees, audit, RLS) against a Supabase project. Nothing is mocked.

## One-time setup
1. In the Supabase SQL editor, run `supabase/e2e-test-business.sql` after setting your owner email at the top. It creates a separate "E2E Test Business"; your real business is never touched.
2. Create `apps/web/.env.integration` (git-ignored; never paste it into chat):
   ```
   INT_SUPABASE_URL=https://<ref>.supabase.co
   INT_SUPABASE_ANON_KEY=<anon key>
   INT_EMAIL=<owner email>
   INT_PASSWORD=<owner password>
   # optional, enables the staff-role and tenant-isolation tests
   INT_STAFF_EMAIL=  INT_STAFF_PASSWORD=
   INT_OUTSIDER_EMAIL=  INT_OUTSIDER_PASSWORD=
   ```
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from `.env.local` are used if the INT_ ones are missing.

## Run
`pnpm --filter @isnabero/web test:integration`

## Notes
- Writes only to the E2E Test Business; records are tagged `[E2E]`. Sold items and voided sales/expenses stay as history (money records are never deleted by design).
- Local alternative (Supabase CLI / self-hosted): set `INT_JWT_SECRET` plus `INT_OWNER_ID` / `INT_STAFF_ID` / `INT_OUTSIDER_ID` instead of passwords.
- Plain `pnpm test` ignores these files.
