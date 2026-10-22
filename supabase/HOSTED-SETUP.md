# Hosted Supabase setup

Isnabero runs against a hosted Supabase project (not `supabase start`). Do these in order. Never paste keys or passwords into
chat, source files or ZIPs — they only go in `apps/web/.env.local`, which is git-ignored.

1. **Create the project** at supabase.com (note the database password you choose). Under *Project Settings → API* copy the
   **Project URL** and the **anon public key**.
2. **Back up first** if the project already holds data (*Database → Backups*).
3. **Apply the migrations in order**, `0000` to `0017`, from `supabase/migrations/`. Either:
   - SQL editor: open each file, paste, run — in numeric order, one at a time; or
   - CLI: `supabase login`, `supabase link --project-ref <ref>`, `supabase db push` (asks for the database password).
   Each file must finish without errors before you run the next. (They were tested in this order on a fresh Postgres 16.)
4. **Seed the demo business** (optional but recommended for a first run): run `supabase/seed.sql` in the SQL editor. It creates
   "Sample Business", the catalog, 4 placeholder employees, opening stock and two weeks of shifts. Running it makes ~50 "System"
   rows in the audit log (triggers) — harmless.
5. **Create your login**: *Authentication → Users → Add user* (email + password, tick auto-confirm).
6. **Link it to the owner**: edit the email in `supabase/link-owner.sql`, run it in the SQL editor. Without this step the app
   shows "No business linked to this account".
7. **Point the app at it**: copy `apps/web/.env.example` to `apps/web/.env.local` and set
   `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL=<Project URL>`, `VITE_SUPABASE_ANON_KEY=<anon key>`. Leave `DATABASE_URL`
   alone unless you use drizzle-kit (then use the *pooler* connection string from the dashboard).
8. `pnpm install`, `pnpm --filter @isnabero/web dev`, sign in, and walk through each page (see the checklist in the knowledge doc,
   Round 27: "NOT verified").

Automated check: with the app set to Supabase mode, `E2E_LIVE=1 E2E_EMAIL=<you> E2E_PASSWORD=<pw> pnpm --filter @isnabero/web e2e:live` signs in, visits every page and signs out (read-only).

## Invites (real logins for new employees)

1. In the dashboard: **Authentication → URL Configuration**: set *Site URL* to your app's address and add `<your app address>/set-password` to *Redirect URLs*.
2. With the Supabase CLI: `supabase login`, `supabase link --project-ref <ref>`, then `supabase functions deploy invite-employee`.
   The service-role key is provided to the function automatically on hosted projects; never put it in the browser env. Optional secret:
   `supabase secrets set SITE_URL=https://your-app-address` (otherwise the browser's own address is used).
3. In the app, **Employees → Invite employee**. The person gets an email, opens the link, chooses a password on the "Set your password" page and lands in the app.

## Automated database tests (no manual clicking)

`apps/web/integration/` holds tests that run the app's real data code against your hosted project: catalog, POS (stock, idempotency, backdating), voiding, expenses, cash close, booking rules, shifts, employees/last-owner rule, audit log, plus signed-out, other-business and staff-permission checks.

1. Run `supabase/e2e-test-business.sql` in the SQL editor (set your email at the top). It makes a separate "E2E Test Business"; your real data is not touched.
2. Create `apps/web/.env.integration` (git-ignored) with `INT_SUPABASE_URL`, `INT_SUPABASE_ANON_KEY`, `INT_EMAIL`, `INT_PASSWORD` (optional staff / outsider logins enable the permission and isolation tests).
3. `pnpm --filter @isnabero/web test:integration`

Details: `apps/web/integration/README.md`.
