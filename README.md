# Isnabero

A modular, multi-tenant business website system. Businesses toggle modules
(POS, Booking, Catalog, etc.) on/off from the sidebar — the core (auth,
dashboard, payment records, employee management, reports) is always present
and adapts to whichever modules are active.

## Stack

TypeScript, React + Vite, Tailwind CSS, shadcn-style components, PostgreSQL
via Supabase (RLS-based multi-tenancy), Drizzle ORM, TanStack Query/Table,
React Hook Form + Zod, Zustand. Turborepo + pnpm monorepo.

## First-time setup

1. Install dependencies:
   ```
   pnpm install
   ```

2. Install the Supabase CLI (if you don't have it) and Docker Desktop, then
   start local Supabase:
   ```
   supabase start
   ```
   This spins up local Postgres, Auth, and Studio. Note the API URL and
   anon key it prints out.

3. Generate and apply the initial schema migration from the Drizzle schema:
   ```
   pnpm db:generate
   ```
   This writes a `0000_*.sql` file into `supabase/migrations/`, ahead of the
   hand-written `0001_rls_policies.sql` that's already there.

   Apply migrations + seed data:
   ```
   supabase db reset
   ```

4. Set up environment variables:
   ```
   cp apps/web/.env.example apps/web/.env.local
   ```
   Fill in `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from
   `supabase status`, and `DATABASE_URL` for Drizzle.

5. Run the dev server:
   ```
   pnpm dev
   ```
   App runs at http://127.0.0.1:5173, Supabase Studio at
   http://127.0.0.1:54323.

## Adding a new module

1. Add the module to `moduleKeyEnum` in `packages/db/src/schema/core.ts`.
2. Create `packages/modules/<name>` (package.json, tsconfig, types.ts,
   hooks.ts, index.ts) following the pattern in `modules/catalog`.
3. Add a route + page in `apps/web/src/pages`, wire it into `App.tsx`.
4. Register it in `apps/web/src/lib/module-registry.ts` — this is what
   makes it appear in the sidebar once toggled on for a business.
5. Toggle it on for a business via a row in `business_modules`.

See `isnabero-knowledge-&-structure.md` for the full file-by-file reference.
