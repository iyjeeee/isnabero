# Isnabero — Knowledge & Structure

## SECTION 1: PROJECT KNOWLEDGE

**What it is:** A modular, multi-tenant business website system. One codebase
serves many different businesses (restaurants, photobooth studios, retail
shops, etc.) by letting each business toggle "modules" on/off from the
sidebar — POS, Online Booking, Catalog, etc. A shared "core" (auth,
dashboard, payment records, employee management, reports) is always present
for every business and is NOT toggleable; it adapts automatically to
whichever modules are active rather than being empty when a module is off.

**Core concept — Catalog/Offerings:** Menu items, product listings, and
service packages/bundles (e.g. "Bundle A: 10 mins unli shots + 2 prints")
are unified under one `offerings` table shared by POS and Booking, instead
of being duplicated per module. An offering is one of: `item` (simple,
no duration), `bundle` (has inclusions, may have a duration), or `addon`
(attaches to another offering). This is what lets the same engine power a
restaurant's menu and a photobooth's package tiers.

**Multi-tenancy:** Every tenant-scoped table has a `business_id` column.
Isolation is enforced via Postgres Row Level Security (RLS) — see
`supabase/migrations/0001_rls_policies.sql`. A user only sees rows for the
business(es) they're an `employee` of (via `auth.uid()` → `employees.user_id`).

**Sidebar/module toggle mechanism:** `business_modules` table stores which
`module_key`s are `enabled` per business. The frontend's `MODULE_REGISTRY`
(`apps/web/src/lib/module-registry.ts`) is the code-side list of modules
with routes/icons/labels. The sidebar renders the intersection: a module
must be BOTH registered in code AND enabled in the DB to appear.

**v1 build order (in progress):** Core (auth/dashboard/payments/employees/
reports) → Catalog → POS → Booking. Inventory and Expenses exist as enum
values in the DB (`moduleKeyEnum`) so the schema is future-proofed, but have
no route/page/registry entry yet — deliberately deferred until there's a
real business asking for them (see "avoid building the full 15-module list
before shipping" discussion).

**Mock/live data-source architecture (major change this round):** Every
module (Catalog, POS, Booking) and every core feature (business_modules/
sidebar, Payment Records, Employees, Dashboard stats) now goes through a
**repository pattern** instead of calling Supabase directly from hooks:

- Each module has `repository.ts` (interface), `mock-repository.ts` (in-
  memory implementation), `supabase-repository.ts` (real implementation),
  and `get-repository.ts` (factory that picks one based on
  `getDataSource()`).
- `getDataSource()` (in `packages/db/src/data-source.ts`) reads
  `VITE_DATA_SOURCE` from the environment — `"mock"` (default) or
  `"supabase"`. Flip that one env var to switch the entire app's data
  source; no component or page code needs to change.
- The mock store (`packages/db/src/mock/store.ts`) is a single shared
  in-memory "database" seeded with the same demo business as
  `supabase/seed.sql` (same hardcoded UUID: `00000000-0000-0000-0000-000000000001`).
  It's shared across all module mock-repositories, so e.g. a POS checkout
  writes a payment record that the Payments page and Dashboard stats can
  both see — cross-module consistency is preserved even without a real DB.
- `useBusinessStore` now defaults to that same demo business id/name
  instead of `null`, so pages render real (mock) data immediately without
  requiring a login flow — that still needs to be built.
- **Why build it this way instead of hardcoding arrays in components:**
  hooks/pages call the repository interface, not Supabase or the mock store
  directly, so swapping data sources later touches zero component code.

**Bugs caught and fixed during this refactor** (worth knowing about if
something behaves unexpectedly in old exported chats/notes):
1. **snake_case/camelCase mismatch** — the original Supabase hooks cast
   raw PostgREST responses (snake_case columns like `is_available`) directly
   to camelCase TypeScript types (`isAvailable`) without any mapping. This
   would have silently produced `undefined` for most fields once real
   Supabase data was used. Fixed with explicit `mapOfferingRow`/
   `mapBookingRow`-style mapper functions in every `supabase-repository.ts`.
2. **`createClient("")` crash** — `apps/web/src/lib/supabase.ts` used to
   pass empty strings to Supabase's `createClient` when env vars were
   unset, which throws immediately (invalid URL) and would have crashed the
   app on load even in mock mode. Fixed with a placeholder URL/key that's
   only ever used when `VITE_DATA_SOURCE=supabase` is explicitly set.
3. **Node-only client leaking into the browser bundle** — `packages/db`
   used to re-export both browser-safe code (schema, mock store) and
   `client.ts` (wraps the `postgres` npm package, which needs Node builtins
   like `fs`/`net`/`perf_hooks`) from one barrel. Once `apps/web` started
   importing `@isnabero/db` directly for the mock store, Vite tried to
   bundle `postgres` for the browser and the production build failed. Fixed
   by splitting the package's exports: `@isnabero/db` (browser-safe: schema,
   mock, data-source) vs. `@isnabero/db/client` (Node-only: `createDb`,
   for future server/edge-function use only).

**Deliberately deferred/simplified for v1:**
- No full inventory/stock-deduction system — `offerings.isAvailable` is a
  manual sold-out/available toggle instead, covering most of the real-world
  need at a fraction of the effort.
- Online payments are simple reference-code input forms (GCash ref number,
  bank transfer ref), not a payment gateway integration.
- POS checkout is single-transaction (payment record → order → line items)
  done as sequential inserts, not wrapped in a DB transaction/RPC yet — fine
  for v1, worth revisiting if partial-failure edge cases start to matter.
- No auth/login flow yet — `useBusinessStore` defaults to the seeded demo
  business so pages have data to render. Build real login before this goes
  anywhere near production.

**Design system (major change this round):** The frontend now has a real,
reusable visual language instead of plain unstyled Tailwind defaults —
built as shared primitives in `packages/ui` so future buttons/cards/
sections reuse tokens and components instead of one-off styling:

- **Extended design tokens** (`packages/config/tailwind.preset.js` +
  `apps/web/src/index.css`): semantic colors `success`/`warning`/`info` (in
  addition to `primary`/`destructive`/etc.), an elevation scale
  (`shadow-card` / `shadow-elevated` / `shadow-floating`), and animation
  keyframes (`animate-fade-in` / `animate-scale-in` / `animate-slide-up`).
  Added the `tailwindcss-animate` plugin (the Dialog's `animate-in`/
  `animate-out`/`fade-in-0` classes depended on this plugin but it was
  never actually installed before now — those classes were silently
  no-ops).
- **New shared components** in `packages/ui`: `Badge` (status/type pills),
  `StatCard` (icon + accent + value, used by Dashboard), `EmptyState`
  (icon + title + description + action, used by every list page),
  `Skeleton` (pulse loading placeholder), `PageHeader` (title +
  description + action slot, standardizes every page's header).
- **`Card` gained an `interactive` prop** — adds the standard hover-lift/
  shadow/border transition. Any clickable tile (Catalog cards, future
  tiles) sets `interactive` instead of writing custom hover classes.
- **`Button` and nav items gained tactile micro-interactions** — active-
  press scale on buttons, hover shadow lift on the primary variant, icon
  scale + slide on sidebar nav hover.
- **Toast notifications** — added `sonner`, wired into `main.tsx` as a
  global `<Toaster>`. Mutations (create offering, toggle availability, POS
  checkout, create booking) now show success/error toasts instead of
  succeeding silently.
- **Every page rewritten** to use `PageHeader`/`EmptyState`/`Skeleton`/
  `Badge` consistently instead of ad-hoc markup: Dashboard (StatCard grid),
  Catalog (type/availability badges, skeleton grid, empty state), POS
  (tactile item tiles, cart remove-line button, empty state), Booking
  (icon-labeled booking cards, empty state), Payments/Employees (badge-
  colored table cells, skeleton rows, empty state), Reports (empty state).
- **Renamed the seed/demo business** from "Demo Cafe" to "Sample Business"
  (in `packages/db/src/mock/store.ts`, `supabase/seed.sql`, and
  `business-store.ts`'s default) — the system was never actually
  cafe-specific (business name is fully dynamic everywhere), but the old
  seed name created that impression while iterating on the UI.

**Visual identity + light/dark theme (follow-up round):** The first design
pass (above) added real components but was still running on shadcn's
*default* theme — default blue accent, system font, thin borders — which
reads as one of the most common "AI-generated admin panel" looks. This
round gave the product an actual identity instead:

- **New palette**: warm amber/gold primary (`hsl(32 90% 46%)` light /
  `hsl(32 95% 55%)` dark) instead of the default blue, off-white main
  background (not stark white), deep-green success / amber warning / blue
  info accents. All still driven by CSS variables in
  `apps/web/src/index.css` — change a value there, it updates everywhere.
- **New typography**: Sora (a geometric grotesk) for headings, applied
  automatically via an `h1`–`h6` base rule in `index.css` — no per-component
  font classes needed. Inter for body/UI text, loaded via Google Fonts in
  `index.html`. `font-feature-settings` enables tabular numbers for
  stat/price figures.
- **Dark navy sidebar as a persistent, separate surface** — new
  `sidebar`/`sidebar-foreground`/`sidebar-muted`/`sidebar-accent`/
  `sidebar-border` tokens (`packages/config/tailwind.preset.js` +
  `index.css`) that stay dark in both light and dark mode. This directly
  answers the "not plain white all the way, but main area should stay
  white/user-friendly" request — the sidebar carries the dark visual
  weight, the content area stays light and readable.
- **Full light/dark mode toggle** — `apps/web/src/stores/theme-store.ts`
  (Zustand) manages the mode, persists to `localStorage`, toggles a `.dark`
  class on `<html>`. `apps/web/src/components/ThemeToggle.tsx` (sun/moon
  icon button, lives in the Sidebar footer) flips it. `index.html` has a
  small inline script that applies the stored/system theme *before* the JS
  bundle loads, so there's no flash of the wrong theme on page load.
- **Verified with real rendered screenshots** (Playwright, not just build
  success) in both light and dark mode across Dashboard and Catalog before
  calling this done.
- **Not yet done**: applying a similar sidebar/content contrast treatment
  is only needed once — every page automatically inherits it since they all
  render inside `AppLayout`. Still open: code-splitting the ~695kB JS
  bundle (same open item as last round, still not urgent at this size).

**Color + dark-mode input fixes (follow-up round):**
- **Primary color changed from amber to maroon** (`hsl(350 65% 32%)` light
  / `hsl(350 70% 48%)` dark) — one token change in `index.css` updated the
  checkout button, active sidebar state, "Add offering" button, and every
  other `bg-primary`/`text-primary` usage app-wide simultaneously, which is
  the whole point of the token-driven approach.
- **Fixed a real dark-mode bug**: the POS cart's quantity input
  (`PosPage.tsx`) was a raw HTML `<input>`, never wired to the shared
  `Input` component — so it fell back to the browser's native control
  rendering (stark white background, washed-out text) instead of the app's
  theme. Fixed two ways: (1) added `color-scheme: light` / `color-scheme:
  dark` to `:root`/`.dark` in `index.css` so browsers render native form
  control chrome (spinners, etc.) in the right palette by default, and (2)
  added a base-layer fallback (`input, textarea, select { @apply
  bg-background text-foreground border-input }`) so ANY raw form control
  anywhere in the app respects the theme even if a future page forgets to
  use the shared component. Also swapped the POS quantity input to
  actually use the shared `Input` component, for consistency.
- **Verified with real rendered screenshots** (dark mode POS page with
  items in cart) rather than just trusting the code change.

**Content density + layout width fixes (follow-up round):** Feedback was
that pages felt empty (just a header + 3 stat cards, huge unused white
space) and that the content area wasted horizontal space on wide screens.

- **`AppLayout.tsx`**: removed the `max-w-6xl` cap that was leaving large
  empty margins on wide monitors — content area is now fluid width with
  responsive padding (`px-6 lg:px-10 xl:px-14`) instead of a fixed cap.
- **`PageHeader` redesigned** (`packages/ui`): now a proper bordered/
  shadowed banner card with an optional icon chip, instead of bare floating
  `<h1>`/`<p>` text. One component change, every page picked it up. Most
  pages now pass an `icon` prop matching their sidebar icon for visual
  continuity between nav and page.
- **Dashboard rebuilt** with three new cards below the stat row: **Quick
  Actions** (shortcut links to POS/Catalog/Booking, filtered to only show
  enabled modules), **Getting Started** checklist (enable a module → add an
  offering → record a sale/booking → add a teammate, computed from real
  data via existing hooks, not hardcoded), **Recent Activity** (last 5
  payment records). Dashboard was the emptiest page before this.
- **Employees**: added a real **"Add Employee" feature** — this was a
  genuine functional gap (no way to add employees via UI at all before
  now). New `CreateEmployeeInput`/`createEmployee` added to
  `CoreRepository` (interface + mock + Supabase implementations),
  `useCreateEmployee` hook, `AddEmployeeModal` component (name + role
  form). **Known limitation, documented in code comments**: `userId` is a
  placeholder random UUID since there's no real invite/auth flow yet — the
  created employee record isn't linkable to an actual login until that's
  built. Also added a 3-stat summary row (Total/Owners/Staff).
- **Payments**: added a 3-stat summary row (Total Transactions, Total
  Collected, Average Transaction) above the table, computed client-side
  from the already-fetched records.
- **Reports**: replaced the single bare empty state with a preview grid —
  one "Coming soon" card per enabled module (Sales Report for POS, Booking
  Report for Booking, Catalog Report for Catalog), so the page explains
  what's coming instead of just being blank.
- **Catalog**: added a search input (filters by name) and type-filter tabs
  (All/Items/Bundles/Add-ons), both client-side over the already-fetched
  offerings list.
- **Booking**: added a 3-stat summary row (Today's Bookings, Confirmed,
  Next Booking time).
- **Verified**: typecheck + build both clean, then rendered every changed
  page with Playwright and extracted actual text content to confirm real
  data (not placeholders) renders correctly with zero console/runtime
  errors, before calling this done.

**FilterBar, table Actions, Booking modal (follow-up round):**
- **New `FilterBar` component** (`packages/ui`): a bordered/card container
  for grouping search inputs + filter tabs, so "controls that narrow the
  list below" are always visually distinct instead of floating loose above
  a table/grid. Applied to Catalog (search + type tabs), Employees (search
  + role tabs), Payments (search + method tabs), Booking (search by
  customer name), and POS (search offerings) — every list-style page now
  has the same filter-section pattern.
- **New `ConfirmDialog` component** (`packages/ui`): the one confirmation
  modal every destructive action uses, instead of each feature building
  its own. Controlled component — pairs with a local `open` state next to
  the trigger button (see `DeleteEmployeeButton`/`DeletePaymentRecordButton`
  for the pattern).
- **Employees table**: added a real **Actions column** — Edit (pencil icon
  → `EditEmployeeModal`, pre-filled form, calls new `updateEmployee`) and
  Delete (trash icon → `ConfirmDialog` → new `deleteEmployee`). Both added
  to `CoreRepository` (interface + mock + Supabase).
- **Payments table**: added an **Actions column with Delete only** —
  deliberately NO edit. A payment record is a snapshot of a POS order or
  booking total; editing its amount post-hoc would desync it from the
  source order, so only deletion (for correcting mistaken/duplicate/test
  entries) is supported, with a `ConfirmDialog` that explicitly warns it
  does NOT reverse the linked order/booking. New `deletePaymentRecord`
  added to `CoreRepository` (interface + mock + Supabase). **NOTE: this was
  superseded in the very next round below — deletePaymentRecord became
  voidPaymentRecord (soft delete). See that round for the current
  behavior.**
- **Booking's "New Booking" form is now a modal** (`NewBookingModal`,
  same trigger/dialog pattern as `CreateOfferingModal`), replacing the
  always-visible inline form in a right-hand column. The bookings list is
  now full-width below the stat row + FilterBar.
- **Verified functionally, not just visually**: used Playwright to
  actually click through Add → Edit → Delete on an employee (counts
  updated correctly at each step), open the New Booking modal and create a
  real booking (stat row updated from 0→1, booking card appeared), and run
  a full POS checkout → Payments page → delete flow (transaction appeared
  with correct total, then disappeared after confirm). One methodology
  note for future testing in this repo: navigating via a full URL reload
  (`page.goto`) wipes the in-memory mock store, since it's a JS singleton,
  not persisted storage — testing multi-page mock-data flows requires
  clicking in-app nav links instead, not doing a hard navigation.

**Sidebar collapse, action button colors, auth foundation, and all 7
recommendations (major round):** This round covered three direct requests
plus implementing every recommendation from the previous round, in order.

*Note on this round's process:* the sandbox this work was done in reset
mid-round, losing everything built up to that point (the project directory
itself was gone). Recovered by having the person re-upload their current
project — which matched the state through the previous round exactly,
confirmed by diffing key files before proceeding — then rebuilding
everything from there. Mentioned here in case anything seems duplicated or
oddly-timestamped in git history. **This happened a second time at the
start of the very next round** (seed data + reports) — that time it was
recoverable WITHOUT asking for a re-upload, by layering the person's last
full upload with Claude's own last delivered delta ZIP (both still present
in the sandbox's file system), then verifying the reconstruction against
the knowledge doc and by running the full test suite before proceeding.
Worth knowing this sandbox has had recurring mid-task resets — if it
happens again, the fastest recovery path is: check for the person's most
recent upload + Claude's most recent delivered ZIP, layer them, diff
against this doc, run tests to confirm, then proceed. Only fall back to
asking for a fresh upload if no recent upload exists in the sandbox at all.

- **Sidebar collapse** — `apps/web/src/stores/sidebar-store.ts` (Zustand,
  persists to `localStorage`), applied in `Sidebar.tsx`: collapses to a
  16-unit icon-only rail (labels hidden, `title` attribute for a native
  tooltip) with a smooth width transition, toggle button at the bottom.
- **`ActionIconButton`** (`packages/ui`) — the one reusable component for
  every table action icon now: `action="edit"` (permanent blue/info tint)
  or `action="delete"` (permanent red/destructive tint), NOT just a hover
  state — this was the specific ask ("edit button blue, delete button
  red, general shared style"). Applied to `EditEmployeeModal`'s trigger,
  `DeleteEmployeeButton`, and `VoidPaymentRecordButton`.
- **Auth foundation** (recommendation #1) — `AuthProvider`
  (`apps/web/src/providers/AuthProvider.tsx`) is the single source of truth
  for "who's logged in" and "what's their role". Mock mode synthesizes a
  session for the seeded owner (`DEMO_OWNER_USER_ID`, now a STABLE constant
  in `packages/db/src/mock/store.ts` instead of a random `genId()`, so the
  same identity persists across reloads) — the whole app works without a
  real Supabase project. Supabase mode wires up real
  `supabase.auth.getSession()`/`onAuthStateChange`. `ProtectedRoute`
  redirects to `/login` when unauthenticated (never triggers in mock mode).
  `LoginPage` does real `signInWithPassword`. Sidebar got a working
  Sign Out button (no-ops with an explanatory toast in mock mode, since
  there's no real session to clear). `CoreRepository.getCurrentEmployee`
  resolves the employee row for the auth user + business.
  **New Edge Function** `supabase/functions/invite-employee/index.ts` —
  properly invites via the Auth admin API (needs the service role key,
  which must never reach the browser, hence a server-side function) instead
  of the old placeholder-random-userId approach. `AddEmployeeModal` now
  branches: supabase mode calls this function (real invite, collects an
  email field now); mock mode keeps the old direct-create behavior.
  **Honest caveat**: the supabase-mode auth/invite code paths are written
  correctly but UNTESTED against a live Supabase project — this sandbox
  has no real backend to verify against. Mock-mode paths (which is
  everything reachable in local dev without live infra) were verified via
  Playwright.
- **Role enforcement** (recommendation #2) — `useHasRole(['owner',
  'admin'])` (`apps/web/src/hooks/use-has-role.ts`) gates management
  actions. Employees page: Add/Edit/Delete only render for owner/admin
  (staff can view the list but not manage it). Payments page: the Actions
  column (void) only renders for owner/admin.
- **Pagination** (recommendation #3) — new `Pagination` component
  (`packages/ui`) + `usePagination` hook (`apps/web/src/hooks/
  use-pagination.ts`, client-side, resets to page 1 automatically when a
  filter shrinks the result set below the current page). Applied to
  Payments (10/page), Employees (10/page), Catalog (9/page).
- **CSV export** (recommendation #4) — `exportToCsv` utility
  (`apps/web/src/lib/export-csv.ts`, dependency-free: builds a CSV string,
  triggers a Blob download). "Export CSV" button on Payments, respects the
  current search/filter.
- **Soft-delete for payment records** (recommendation #5) — payment
  records are financial history, so deleting one outright was replaced
  with **voiding**: new `voidedAt` column on `payment_records` (schema +
  `supabase/migrations/0002_void_payment_records.sql`), `voidPaymentRecord`
  replaces `deletePaymentRecord` in `CoreRepository`, `listPaymentRecords`
  takes an `includeVoided` option (defaults to excluding them from both the
  list AND dashboard/summary stat totals). Payments page has a "Show
  voided" checkbox; voided rows show a "Voided" badge and are visually
  dimmed. `DeletePaymentRecordButton` renamed to `VoidPaymentRecordButton`
  (uses the `Ban` icon, not `Trash2`) with softer, accurate confirm-dialog
  language.
- **Code-splitting** (recommendation #6) — two layers: (1) every page in
  `App.tsx` is now `React.lazy()`-loaded with a `Suspense` fallback, so
  each page is its own chunk loaded on first visit; (2) `vite.config.ts`
  splits `@supabase/supabase-js` (216kB) into its own cacheable
  `manualChunks` entry. **A real bug was caught and fixed here**: the
  first attempt also split React itself and Radix into separate chunks,
  which created a circular chunk dependency (`vendor-radix` ↔
  `vendor-react`) that broke the app at runtime (`Cannot read properties
  of undefined (reading 'forwardRef')` — a module load-order failure, not
  visible until actually running the built app in a browser, not just
  running the build command). Fixed by only splitting out libraries with
  ZERO React dependency (`@supabase/supabase-js`) and leaving React +
  everything that depends on it (react-router, react-query, radix,
  react-hook-form) bundled together. Net result: no more "chunk larger
  than 500kB" warning, biggest chunk now ~365kB.
- **Basic automated tests** (recommendation #7) — Vitest added to every
  package with real logic to test: `packages/modules/catalog`,
  `packages/modules/pos`, `packages/modules/booking`,
  and `apps/web` (`CoreRepository`'s mock implementation). 13 tests total,
  covering: offering/bundle creation with inclusions, availability
  toggling, POS checkout (total calculation, payment record creation,
  order line items), booking creation + date-range filtering, employee
  CRUD, and the void-payment-record soft-delete semantics (including that
  voided records are excluded from dashboard stats). Run via `pnpm test`
  (root) or `pnpm --filter <package> test` individually. Tests mutate the
  shared in-memory `mockDb`, so they're written to check relative
  before/after deltas rather than absolute counts, to stay safe regardless
  of test execution order.
- **Verified**: typecheck, full build, and the full test suite (13/13
  passing) all clean. Functionally verified via Playwright: sidebar
  collapse (256px ↔ 64px), role-gated buttons rendering correctly for the
  owner role, action button tint colors (computed style confirmed: edit =
  `rgba(12, 142, 202, 0.1)`, delete = `rgba(220, 40, 40, 0.1)`), and the
  full void-payment flow (transaction count 1→0, correctly excluded from
  the default view after voiding).


**Recently completed (previous rounds):**
- Catalog "Add offering" modal — full form (name, description, type, price,
  duration, dynamic bundle inclusions) via react-hook-form + zod, backed by
  `useCreateOfferingWithInclusions` which writes the offering and its
  inclusion rows together.
- POS checkout modal — payment method selector (cash/GCash/bank transfer/
  other) with a conditional reference-code field, replacing the previous
  hardcoded `method: "cash"`.
- Dashboard real aggregates — pulls today's sales total, upcoming bookings
  count, and active employee count instead of hardcoded zeros.


**User's standing dev workflow preferences (apply to all work on this
project):** prioritize efficiency/scalability/clean structure; separate
features into dedicated files; stay consistent with existing patterns
(structure, color palette, components) rather than introducing new
conventions; concise single-line inline comments; double-check for errors
before delivering and explain root cause if found; check existing codebase
before creating new files to avoid duplication; implement changes one at a
time, in order; update this doc when the structure changes meaningfully;
deliver a ready-to-extract ZIP with only changed/created files.

---

## SECTION 2: FULL CODEBASE FILE STRUCTURE

### Root / Monorepo Config
- `package.json` — root scripts (`dev`, `build`, `lint`, `typecheck`,
  `db:generate`, `db:migrate`), pnpm/turbo devDependencies. Include when
  changing workspace-wide scripts or tooling versions.
- `pnpm-workspace.yaml` — declares `apps/*`, `packages/*`,
  `packages/modules/*` as workspace packages. Include when adding a new
  top-level package location.
- `turbo.json` — task pipeline (dev/build/lint/typecheck) and caching rules.
  Include when adding a new turbo-run task type.
- `tsconfig.base.json` — shared strict TS compiler options, extended by
  every package's own tsconfig. Include when changing global TS strictness.
- `.gitignore` — standard ignores (node_modules, dist, .env, supabase temp).
- `README.md` — setup/run instructions for local dev. Include when onboarding
  steps change.

### Database & Schema — `packages/db`
- `package.json` — drizzle-orm/postgres deps, drizzle-kit scripts. Has an
  `exports` map: `"."` → `src/index.ts` (browser-safe: schema, mock,
  data-source), `"./client"` → `src/client.ts` (Node-only, server/edge-
  function use). Keep these separate — see "Bugs caught" note above.
- `drizzle.config.ts` — points drizzle-kit at `src/schema/index.ts`, outputs
  migrations to `supabase/migrations`, reads `DATABASE_URL`.
- `src/client.ts` — `createDb(connectionString)` factory using
  drizzle-orm/postgres-js. Import via `@isnabero/db/client`, NEVER from the
  main `@isnabero/db` entry (it would pull Node builtins into the browser
  bundle). Server/edge-function use only.
- `src/data-source.ts` — `getDataSource()`: reads `VITE_DATA_SOURCE` env var
  ("mock" default | "supabase"). Every module's `get-repository.ts` calls
  this to decide which repository implementation to use.
- `src/mock/store.ts` — `mockDb`: shared in-memory tables (businesses,
  businessModules, employees, paymentRecords, offerings, offeringInclusions,
  posOrders, posOrderItems, bookings), seeded to match `supabase/seed.sql`.
  `DEMO_BUSINESS_ID` (exported here) is the one hardcoded UUID used
  everywhere a "current business" default is needed. Also exports `genId()`
  and `delay()` helpers used by every mock-repository.
- `src/mock/index.ts` — barrel for the mock store.
- `src/index.ts` — package entry: re-exports schema, data-source, mock.
  Does NOT re-export `client.ts` (see exports map note above).
- `src/schema/core.ts` — **always-on core tables**: `businesses`,
  `businessModules` (drives sidebar), `employees`, `paymentRecords`. Also
  `employeeRoleEnum`, `moduleKeyEnum` (the master module list),
  `paymentMethodEnum`. Include whenever touching auth, tenancy, payments
  ledger, or staff roles, or when adding a new module (extend
  `moduleKeyEnum` here first).
- `src/schema/catalog.ts` — `offerings` (item/bundle/addon) and
  `offeringInclusions` (bundle contents). Include when working on menu/
  product/package features for any module.
- `src/schema/pos.ts` — `posOrders`, `posOrderItems`. Include for POS
  checkout/order-history work.
- `src/schema/booking.ts` — `bookings` (slots against offerings),
  `bookingStatusEnum`, `bookingModeEnum`. Include for booking/calendar work.
- `src/schema/index.ts` — barrel re-exporting all schema files.

### Supabase — `supabase/`
- `config.toml` — local Supabase CLI project config (ports, auth settings).
- `migrations/0001_rls_policies.sql` — hand-written RLS policies enforcing
  per-business row isolation on every tenant table, plus the
  `employee_business_ids()` helper function. Include whenever adding a new
  table that needs tenant isolation, or debugging "why can't this user see
  their data" issues. NOTE: drizzle-kit will generate `0000_*.sql` (the
  actual `CREATE TABLE` statements) once `pnpm db:generate` is run against a
  live DB connection — that file does not exist yet in this scaffold.
- `seed.sql` — demo business ("Demo Cafe") with catalog/pos/booking enabled
  and two sample offerings, auto-applied on `supabase db reset`. Safe to
  edit/clear.

### Shared UI — `packages/ui`
- `package.json` — cva, clsx, tailwind-merge, lucide-react, radix-slot,
  radix-dialog, radix-label deps.
- `src/lib/utils.ts` — `cn()` classname merge utility, used by every
  component in this package and throughout the app.
- `src/components/button.tsx` — shadcn-style `Button` with variant/size cva
  config (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
  × `default`, `sm`, `lg`, `icon`). Includes active-press scale + hover
  shadow lift on the default variant. Include for any new button styling.
- `src/components/card.tsx` — `Card`, `CardHeader`, `CardTitle`,
  `CardDescription`, `CardContent`. `Card` accepts an `interactive` prop
  for the standard hover-lift/shadow/border transition — use this instead
  of custom hover classes for any clickable tile.
- `src/components/dialog.tsx` — Radix-based `Dialog`, `DialogContent`,
  `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`.
  `DialogContent` has `max-h-[85vh] overflow-y-auto` so long dialogs
  scroll internally instead of overflowing off-screen — don't remove this.
  Include when building any modal.
- `src/components/input.tsx` — styled `Input`. Include for any form field.
- `src/components/textarea.tsx` — styled `Textarea`.
- `src/components/label.tsx` — Radix-based `Label`.
- `src/components/select.tsx` — styled native `Select` wrapper (no Radix —
  kept simple since forms here don't need custom option rendering).
- `src/components/badge.tsx` — `Badge`: variant-driven pill (`default`,
  `secondary`, `success`, `warning`, `info`, `destructive`, `outline`).
  Include for any status/type label (offering type, booking status,
  payment method, employee role, etc.) instead of custom colored spans.
- `src/components/stat-card.tsx` — `StatCard`: icon + accent-colored badge
  + label + value, with a built-in loading skeleton state. Include for any
  dashboard-style numeric summary.
- `src/components/empty-state.tsx` — `EmptyState`: icon + title +
  description + optional action, for any list page with no data yet.
- `src/components/skeleton.tsx` — `Skeleton`: single pulsing placeholder
  block. Compose several to build a loading version of any layout.
- `src/components/page-header.tsx` — `PageHeader`: rendered as a bordered/
  shadowed banner card (not bare floating text), with an optional `icon`
  chip + title + description + right-aligned action slot. Every page's
  `<h1>` should go through this.
- `src/components/confirm-dialog.tsx` — `ConfirmDialog`: the one
  confirmation modal every destructive action (delete, remove) should use.
  Controlled (`open`/`onOpenChange` props) — pair with local state next to
  the trigger button.
- `src/components/filter-bar.tsx` — `FilterBar`: bordered container for
  grouping search inputs + filter tabs above a list/table/grid. Use on any
  page with search/filter controls instead of a bare flex row.
- `src/index.ts` — package entry, re-exports all components + `cn`.

### Design Tokens — `packages/config`
- `tailwind.preset.js` — shared Tailwind theme extension: color tokens
  (including semantic `success`/`warning`/`info` and the separate
  `sidebar`/`sidebar-foreground`/`sidebar-muted`/`sidebar-accent`/
  `sidebar-border` set), font families (`font-sans` = Inter,
  `font-display` = Sora), an elevation/shadow scale
  (`shadow-card`/`shadow-elevated`/`shadow-floating`), animation
  keyframes (`animate-fade-in`/`animate-scale-in`/`animate-slide-up`), and
  the `tailwindcss-animate` plugin. Extended by every app's own
  `tailwind.config.cjs`. Include when changing the color palette, fonts,
  shadow scale, or animation system globally — this is the single place to
  add a new token so it's available everywhere, rather than inventing a
  one-off value in a component. Actual color VALUES (the HSL numbers) live
  in `apps/web/src/index.css`, not here — this file only defines the token
  NAMES/structure.

### Module: Catalog — `packages/modules/catalog`
- `package.json` — depends on `@isnabero/db`, `@tanstack/react-query`,
  `drizzle-orm`.
- `src/types.ts` — `Offering`, `NewOffering`, `OfferingInclusion`,
  `OfferingWithInclusions` (inferred from db schema).
- `src/repository.ts` — `CatalogRepository` interface (`listOfferings`,
  `createOfferingWithInclusions`, `toggleAvailability`) + `CreateOfferingInput`
  type. The contract both implementations below satisfy.
- `src/mock-repository.ts` — in-memory implementation, reads/writes
  `mockDb` from `@isnabero/db`.
- `src/supabase-repository.ts` — real implementation. Includes explicit
  `mapOfferingRow`/`mapInclusionRow` functions (snake_case → camelCase) —
  include when debugging "field is undefined" issues with real data.
- `src/get-repository.ts` — `getCatalogRepository(supabase)`: picks mock vs
  supabase based on `getDataSource()`.
- `src/hooks.ts` — `useOfferings`, `useCreateOfferingWithInclusions` (writes
  offering + bundle inclusions together — used by the Add Offering modal),
  `useToggleOfferingAvailability`. All call the repository, not Supabase
  directly.
- `src/index.ts` — module entry.

### Module: POS — `packages/modules/pos`
- `package.json` — depends on `@isnabero/db`, `@isnabero/module-catalog`,
  `@tanstack/react-query`, `zustand`, `drizzle-orm`.
- `src/types.ts` — `PosOrder`, `NewPosOrder`, `PosOrderItem`,
  `NewPosOrderItem`, `CartLine`.
- `src/repository.ts` — `PosRepository` interface (`checkout`) +
  `CheckoutInput`/`CheckoutResult` types.
- `src/mock-repository.ts` — writes into the shared `mockDb` (payment
  record → order → order items), so mock checkouts show up on the Payments
  page and Dashboard immediately.
- `src/supabase-repository.ts` — real implementation (payment record →
  order → order items, sequential inserts).
- `src/get-repository.ts` — `getPosRepository(supabase)` factory.
- `src/cart-store.ts` — `useCartStore` (Zustand): in-memory cart state
  (`addOffering`, `updateQuantity`, `removeLine`, `clear`, `total`). Client
  state only — not affected by the mock/live data-source switch.
- `src/hooks.ts` — `useCheckout`: calls the repository, then invalidates
  `payment_records`, `pos_orders`, and `dashboard_stats` queries.
- `src/index.ts` — module entry.

### Module: Booking — `packages/modules/booking`
- `package.json` — depends on `@isnabero/db`, `@isnabero/module-catalog`,
  `@tanstack/react-query`, `drizzle-orm`.
- `src/types.ts` — `Booking`, `NewBooking`, `BookingWithOffering`.
- `src/repository.ts` — `BookingRepository` interface (`listBookings`,
  `createBooking`) + `CreateBookingInput` type.
- `src/mock-repository.ts` — in-memory implementation, joins bookings to
  their offering + inclusions from `mockDb`.
- `src/supabase-repository.ts` — real implementation with explicit
  `mapBookingRow`/`mapOfferingRow` mapping (snake_case → camelCase, both on
  read and on write).
- `src/get-repository.ts` — `getBookingRepository(supabase)` factory.
- `src/hooks.ts` — `useBookings` (date-range list), `useCreateBooking`.
- `src/index.ts` — module entry.

### Web App — `apps/web`
- `package.json` — all app-level deps (react-router, react-hook-form, zod,
  supabase-js, tanstack table, etc.) plus workspace package links.
- `vite.config.ts` — Vite + React plugin, `@` path alias → `src`.
- `tailwind.config.cjs` — extends `packages/config` preset, sets content
  globs (app src + `packages/ui`). NOTE: `.cjs` extension required because
  `package.json` has `"type": "module"`.
- `postcss.config.cjs` — Tailwind + autoprefixer. Same `.cjs` note applies.
- `tsconfig.json` — extends root base, sets `@/*` path alias.
- `index.html` — Vite entry HTML.
- `.env.example` — documents `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_DATA_SOURCE` (mock|supabase — see Section 1), `DATABASE_URL`. Copy
  to `.env.local` and fill in real values — never commit `.env.local`.

**`src/` — Entry & Global**
- `src/main.tsx` — React root, mounts `<App>` inside `QueryClientProvider`
  and `BrowserRouter`, plus a global `<Toaster>` (sonner) for success/error
  notifications from any mutation in the app.
- `index.html` — includes Google Fonts links (Sora + Inter) and an inline
  script that applies the stored/system theme before the JS bundle loads
  (avoids a flash of the wrong theme). Include when changing fonts or the
  theme-init logic.
- `src/index.css` — Tailwind directives + CSS variable design tokens for
  BOTH light (`:root`) and dark (`.dark`) mode, plus the separate
  `--sidebar-*` tokens (stay dark in both modes). Also the `h1`-`h6` →
  `font-display` base rule. Include when re-theming the app's colors or
  typography.
- `src/vite-env.d.ts` — `import.meta.env` type declarations, including
  `VITE_DATA_SOURCE`.
- `src/App.tsx` — top-level route table. Include whenever adding a new
  page/route.

**`src/lib/` — Utilities & Config**
- `src/lib/supabase.ts` — Supabase client singleton. Uses a placeholder
  URL/key when unset so it never crashes on load in mock mode (`createClient`
  throws on an empty string) — only warns if `VITE_DATA_SOURCE=supabase`
  and real env vars are actually missing.
- `src/lib/module-registry.ts` — **`MODULE_REGISTRY`**: the code-side list
  of modules with sidebar label/path/icon. `ModuleKey` type must stay in
  sync with `moduleKeyEnum` in `packages/db/src/schema/core.ts`. Include
  whenever adding, renaming, or reordering a sidebar module entry.
- `src/lib/repositories/repository.ts` — `CoreRepository` interface for
  everything always-on (not a toggleable module): `listEnabledModules`,
  `listPaymentRecords`, `listEmployees`, `createEmployee`,
  `getDashboardStats`.
- `src/lib/repositories/mock-repository.ts` — in-memory implementation,
  reads `mockDb` from `@isnabero/db`.
- `src/lib/repositories/supabase-repository.ts` — real implementation, with
  explicit snake_case → camelCase row mapping. `createEmployee` uses a
  placeholder random `user_id` (see Section 1 note on the missing
  invite/auth flow).
- `src/lib/repositories/get-repository.ts` — `getCoreRepository(supabase)`
  factory, same mock/supabase switch pattern as the module repositories.

**`src/stores/` — Global Client State**
- `src/stores/business-store.ts` — `useBusinessStore` (Zustand): current
  tenant context (`businessId`, `businessName`). **Defaults to the seeded
  demo business** ("Sample Business", `DEMO_BUSINESS_ID` from
  `@isnabero/db`) instead of null, so pages render data before login
  exists. Replace this default once real auth is built — `setBusiness`
  should then be called with the logged-in employee's actual business_id.
- `src/stores/theme-store.ts` — `useThemeStore` (Zustand): light/dark mode
  state. Persists to `localStorage` (`isnabero-theme` key), toggles the
  `.dark` class on `<html>`. Works together with the inline script in
  `index.html` (avoids theme-flash on load).

**`src/hooks/` — Data Hooks (app-level, not module-specific)**
- `src/hooks/use-business-modules.ts` — `useBusinessModules(businessId)`:
  calls `CoreRepository.listEnabledModules`. Include when debugging "module
  not showing in sidebar" issues.
- `src/hooks/use-dashboard-stats.ts` — `useDashboardStats(businessId)`:
  calls `CoreRepository.getDashboardStats`. Include when changing what the
  Dashboard shows.
- `src/hooks/use-create-employee.ts` — `useCreateEmployee(businessId)`:
  calls `CoreRepository.createEmployee`, invalidates the employees list and
  dashboard stats on success.

**`src/hooks/` — Data Hooks (app-level, not module-specific)** (continued)
- `src/hooks/use-update-employee.ts` — `useUpdateEmployee(businessId)`:
  calls `CoreRepository.updateEmployee`, invalidates the employees list.
- `src/hooks/use-delete-employee.ts` — `useDeleteEmployee(businessId)`:
  calls `CoreRepository.deleteEmployee`, invalidates employees list +
  dashboard stats.
- `src/hooks/use-delete-payment-record.ts` —
  `useDeletePaymentRecord(businessId)`: calls
  `CoreRepository.deletePaymentRecord`, invalidates payment records +
  dashboard stats.

**`src/components/` — Reusable Feature Components**
- `src/components/catalog/CreateOfferingModal.tsx` — "Add offering" form
  (react-hook-form + zod): name, description, type, price, duration,
  dynamic bundle inclusions list (shown only when type = bundle). Shows a
  success toast on save. Include when changing what fields an offering can
  have.
- `src/components/pos/CheckoutModal.tsx` — payment method selector (cash/
  GCash/bank transfer/other) with conditional reference-code field. Include
  when changing checkout/payment-method behavior.
- `src/components/booking/NewBookingModal.tsx` — "New booking" form (same
  trigger/dialog pattern as `CreateOfferingModal`): package select,
  customer name, start time. Lives in Booking's `PageHeader` action slot,
  replacing what used to be an always-visible inline form.
- `src/components/employees/AddEmployeeModal.tsx` — "Add employee" form
  (react-hook-form + zod): full name + role select. Dialog description
  explicitly notes the placeholder-userId limitation to the person using
  it. Shows a success toast on save.
- `src/components/employees/EditEmployeeModal.tsx` — pencil-icon trigger,
  pre-filled name/role form, calls `useUpdateEmployee`. Lives in the
  Employees table's Actions column.
- `src/components/employees/DeleteEmployeeButton.tsx` — trash-icon trigger
  + `ConfirmDialog`, calls `useDeleteEmployee`. Lives in the Employees
  table's Actions column.
- `src/components/payments/DeletePaymentRecordButton.tsx` — trash-icon
  trigger + `ConfirmDialog` with an explicit warning that deleting a
  transaction does NOT reverse the linked order/booking. Lives in the
  Payments table's Actions column (Payments deliberately has no Edit — see
  Section 1 note).
- `src/components/ThemeToggle.tsx` — sun/moon icon button, calls
  `useThemeStore`. Lives in the Sidebar footer.

**`src/layouts/` — Shell**
- `src/layouts/Sidebar.tsx` — dark navy surface (via `sidebar-*` tokens,
  NOT the main `background` token) with a branded header (icon + business
  name), `CORE_NAV` (always-on: Dashboard, Payment Records, Employees,
  Reports), the dynamic module nav (`MODULE_REGISTRY` filtered by
  `useBusinessModules`), and a `ThemeToggle` footer. Active nav item gets a
  solid maroon (`primary`) background; hover states have icon scale + slide
  micro-animations. Include whenever changing sidebar behavior, colors, or
  the core nav list.
- `src/layouts/AppLayout.tsx` — Sidebar + fluid-width content container
  (`px-6 lg:px-10 xl:px-14`, NO max-width cap — was `max-w-6xl`, removed
  because it wasted horizontal space on wide screens) with a fade-in
  animation + `<Outlet>` wrapper for all authenticated routes.

**`src/pages/` — Screens**
- `src/pages/DashboardPage.tsx` — `PageHeader` + `StatCard` grid, plus
  three content cards: **Quick Actions** (links to enabled modules'
  primary action), **Getting Started** checklist (computed from real
  hook data: `useBusinessModules`, `useOfferings`, payment records,
  employee count), **Recent Activity** (last 5 payment records via
  `CoreRepository.listPaymentRecords`).
- `src/pages/PaymentsPage.tsx` — 3-stat summary row + `FilterBar` (search
  reference/source + method-filter tabs) + payment ledger table with an
  **Actions column (Delete only via `DeletePaymentRecordButton`** — no
  Edit, deliberately). Method column uses color-coded `Badge`; skeleton
  rows while loading; `EmptyState` for both "no data" and "no filter
  matches". Always-on, not a module page.
- `src/pages/EmployeesPage.tsx` — 3-stat summary row + `FilterBar` (search
  + role-filter tabs) + staff table with an **Actions column** (`Edit` via
  `EditEmployeeModal`, `Delete` via `DeleteEmployeeButton`). Role column
  uses color-coded `Badge`; skeleton rows; `EmptyState` for both empty and
  no-matches states. `AddEmployeeModal` in the `PageHeader` action slot.
- `src/pages/ReportsPage.tsx` — `PageHeader` + a preview grid of "Coming
  soon" report cards, one per enabled module (`UPCOMING_REPORTS` array
  filtered by `useBusinessModules`); intended to become a framework where
  each module registers its own real report widget later.
- `src/pages/CatalogPage.tsx` — `FilterBar` (search + type-filter tabs:
  All/Items/Bundles/Add-ons) above an offering grid (`Card interactive`)
  with type `Badge`, price, inclusions list, available/sold-out `Badge` +
  toggle button (shows a toast on toggle), skeleton grid while loading,
  `EmptyState` for both empty and no-matches states, and the
  `CreateOfferingModal` in the `PageHeader` action slot.
- `src/pages/PosPage.tsx` — `FilterBar` (search offerings) + tactile
  offering tiles (hover lift + active press) + cart summary with a
  remove-line-item button + `CheckoutModal`. Skeleton grid while loading,
  `EmptyState` when no offerings are available. Shows a toast on completed
  sale.
- `src/pages/BookingPage.tsx` — 3-stat summary row + `NewBookingModal` in
  the `PageHeader` action slot (replaced the old always-visible inline
  form) + `FilterBar` (search by customer name) + full-width bookings list
  (icon-labeled `Card interactive` rows). Skeleton rows while loading,
  `EmptyState` for both empty and no-matches states. Shows a toast on
  successful booking, an error toast if required fields are missing.

**Expanded seed data + real Sales/Booking/Catalog reports (major round):**
Two direct requests: more realistic placeholder data, and turning the Reports
page's "Coming soon" placeholder cards into real, working reports.

- **Mock seed data rewritten** (`packages/db/src/mock/store.ts`) — went from
  2 offerings/1 employee/0 history to: **7 offerings** across all three
  types (4 items, 2 bundles, 1 addon; one item — Iced Tea — deliberately
  marked sold out for realistic variety), **4 employees** across all three
  roles (owner/admin/staff×2), and **21 days of generated historical
  activity** (0-3 POS sales/day with realistic method mix and ~6% voided,
  plus bookings on ~40% of days with a realistic status mix — completed/
  cancelled for past dates, pending/confirmed for today/future — plus a
  handful of near-future bookings so "Upcoming" always has something to
  show). Uses a **deterministic PRNG** (`mulberry32`, fixed seed 1337) —
  NOT `Math.random()` — so the generated data is reproducible across
  reloads/restarts instead of looking different every time the app starts.
  `supabase/seed.sql` updated to match the catalog/employee roster (but
  deliberately does NOT replicate the 21-day generated history in SQL —
  noted in a comment why: that's randomized JS logic not worth hand-porting
  to SQL inserts).
- **New `ReportsRepository`** (`apps/web/src/lib/repositories/
  reports-repository.ts` + mock/supabase implementations + factory) —
  a repository dedicated to cross-table report aggregation, kept separate
  from `CoreRepository` since these are aggregate queries, not simple CRUD.
  Three methods: `getSalesReport` (daily revenue series, payment-method
  breakdown, totals, voided count — active/non-voided only feeds totals),
  `getBookingReport` (daily bookings series, status breakdown, upcoming/
  completed/cancelled counts), `getCatalogReport` (top 5 offerings by
  quantity sold with revenue, available/sold-out counts). Both daily
  series always cover every day in the requested range with explicit
  zeros for quiet days — no gaps or misleading chart spacing.
- **`recharts` added** as a dependency — but only ever imported by
  `ReportsPage` and its child components, which are already
  `React.lazy()`-loaded (from the earlier code-splitting round), so it
  never touches the main app bundle. Confirmed in the build output: its
  own ~415kB chunk (112kB gzipped), loaded only when someone visits
  Reports.
- **Chart color palette** (`apps/web/src/lib/chart-colors.ts`) — literal
  HSL color strings (not `var()` CSS references) matching the app's design
  tokens, shared across all three report components so chart colors stay
  consistent with the rest of the UI without each component picking its
  own colors.
- **Three report components**
  (`apps/web/src/components/reports/{Sales,Booking,Catalog}ReportSection.tsx`)
  — each a `Card` with a stat row + one or two `recharts` charts (bar +
  donut/pie where relevant), with a loading skeleton state.
  `ReportsPage.tsx` rewritten to render whichever sections match the
  business's enabled modules, replacing the old "Coming soon" preview
  cards entirely.
- **Tests added** for the reports repository (5 new tests, 18 total now)
  covering: voided records excluded from sales totals but reported
  separately, daily series length correctness, booking status breakdown,
  top-offerings sort order, and available/sold-out counting.
- **Verified thoroughly**: typecheck clean, full build clean (no chunk-size
  warnings — the lesson from the code-splitting bug earlier is holding),
  all 18 tests passing, and — critically — actually rendered the built app
  in a headless browser and confirmed all three charts render correctly
  with real varied data (zero console/JS errors), not just that the build
  succeeded. Also spot-checked Employees (4 roles), Catalog (7 offerings
  including the sold-out one), and Payments (27 real historical
  transactions, ₱18,713 total) to confirm the expanded seed data flows
  through every page that reads it.

**Sidebar/scroll layout bug fix + dialog overflow fix + dead code cleanup
(bug-fix round):** The person found a real bug via screenshot: when a
page's content was taller than the viewport, the whole browser document
scrolled instead of just the content area, and since the sidebar isn't
fixed/sticky, it scrolled away too — leaving blank white space where it
used to be.

- **Root cause**: `AppLayout.tsx`'s outer container used `min-h-screen`
  (can grow beyond viewport height) instead of `h-screen overflow-hidden`
  (fixed at exactly viewport height). `main`'s `overflow-y-auto` can only
  create its own internal scroll region if its parent is height-
  constrained — with `min-h-screen`, the parent just kept growing instead,
  so the browser's own document scrolled rather than `main`. **Fixed** by
  changing the outer container to `h-screen overflow-hidden` — this is
  the standard, correct pattern for "persistent sidebar + scrollable
  content area" layouts. Also changed `Sidebar.tsx`'s `aside` from an
  independent `h-screen` to `h-full`, so it fills its now-constrained
  parent rather than assuming the parent always equals the viewport.
  **The code comment in `AppLayout.tsx` explicitly says not to revert this
  to `min-h-screen`** — read it before touching this file's layout classes.
- **Proactively found and fixed the same class of bug elsewhere**: while
  double-checking, found `DialogContent` (`packages/ui/src/components/
  dialog.tsx`) had the identical missing-height-constraint problem — a
  dialog with enough content (e.g., adding several bundle inclusions in
  Create Offering) could grow taller than the viewport with literally no
  way to scroll down to reach the Save button. Fixed by adding
  `max-h-[85vh] overflow-y-auto` to `DialogContent` — every dialog in the
  app now scrolls internally instead of ever overflowing off-screen. This
  wasn't reported by the person — caught during the "double-check
  everything" pass they asked for.
- **Dead code removed**: `apps/web/src/components/payments/
  DeletePaymentRecordButton.tsx` and `apps/web/src/hooks/
  use-delete-payment-record.ts` — leftover from before payment deletion
  was changed to voiding (soft delete) several rounds back. Confirmed
  nothing referenced them before deleting.
- **Verified thoroughly, not just by reasoning about the CSS**: rendered
  the actual built app in a 1400×500px viewport (deliberately short, to
  force the exact overflow scenario from the bug report) and confirmed via
  JS evaluation that `document.scrollHeight === document.clientHeight`
  (zero outer scroll exists at all now), that the sidebar's bounding box
  never moves regardless of scroll attempts, and that `main.scrollTop`
  correctly changes when scrolling — i.e., `main` is the one actually
  scrolling internally, exactly as intended. Also took a screenshot
  confirming this visually. Same double-check pass also functionally
  verified two things that were only reasoned-about (not click-tested) in
  the previous round: **pagination** (clicking Next actually changes the
  displayed rows) and **CSV export** (a real file downloads, with correct
  filename, headers, and all 27 records present) — both confirmed working.
  Also confirmed the dialog fix directly: added 8 inclusion rows to a
  bundle offering and confirmed the Save button stayed reachable (dialog
  capped at 850px within a 1000px viewport). All 18 tests still pass,
  typecheck and build both clean.

### New/Changed Files This Round (bug fixes)
- `apps/web/src/layouts/AppLayout.tsx` — outer container `min-h-screen` →
  `h-screen overflow-hidden`. Read the code comment before changing this.
- `apps/web/src/layouts/Sidebar.tsx` — `aside` height class `h-screen` →
  `h-full`.
- `packages/ui/src/components/dialog.tsx` — `DialogContent` gained
  `max-h-[85vh] overflow-y-auto`.
- **Removed** (dead code): `apps/web/src/components/payments/
  DeletePaymentRecordButton.tsx`, `apps/web/src/hooks/
  use-delete-payment-record.ts`.

### New/Changed Files This Round (seed data + reports)

- `packages/db/src/mock/store.ts` — completely rewritten with the
  deterministic-PRNG generator described above. If touching seed data
  again, edit the `offeringsSeed`/`employeesSeed` arrays for static data,
  or the generation loop for historical activity — don't hand-add
  individual payment/booking rows, follow the generator pattern.
- `supabase/seed.sql` — expanded to match (catalog + employees only, not
  history — see comment in the file).
- `apps/web/src/lib/repositories/reports-repository.ts` — interface:
  `SalesReportData`, `BookingReportData`, `CatalogReportData` types +
  `ReportsRepository` interface.
- `apps/web/src/lib/repositories/mock-reports-repository.ts` /
  `supabase-reports-repository.ts` / `get-reports-repository.ts` — same
  mock/Supabase/factory pattern as every other repository in this project.
- `apps/web/src/lib/chart-colors.ts` — `CHART_COLORS`, `METHOD_COLORS`,
  `STATUS_COLORS`. Add new chart colors here, not inline in a report
  component.
- `apps/web/src/components/reports/SalesReportSection.tsx` /
  `BookingReportSection.tsx` / `CatalogReportSection.tsx` — the three real
  report sections, each self-contained (fetches its own data via
  `getReportsRepository`).
- `apps/web/src/pages/ReportsPage.tsx` — rewritten; no longer has the
  `UPCOMING_REPORTS`/"Coming soon" placeholder logic.
- `apps/web/src/lib/repositories/__tests__/reports-repository.test.ts` —
  new test file, 5 tests.
- `apps/web/package.json` — added `recharts` dependency.

### New Files This Round (previous round: sidebar collapse / action buttons / auth / recommendations)
- `apps/web/src/stores/sidebar-store.ts` — `useSidebarStore`: collapsed
  state, persisted to `localStorage`.
- `packages/ui/src/components/action-icon-button.tsx` — `ActionIconButton`:
  the shared Edit (blue)/Delete (red) table-action button.
- `packages/ui/src/components/pagination.tsx` — `Pagination`: prev/next +
  "Showing X-Y of Z" control.
- `apps/web/src/hooks/use-pagination.ts` — `usePagination(items, pageSize)`
  client-side pagination hook.
- `apps/web/src/lib/export-csv.ts` — `exportToCsv(filename, rows)`,
  dependency-free CSV download utility.
- `apps/web/src/providers/AuthProvider.tsx` — auth context (mock-mode
  synthetic session vs. real Supabase auth). Wraps the whole app in
  `App.tsx`.
- `apps/web/src/hooks/use-has-role.ts` — `useHasRole(allowedRoles)` role
  gate, reads from `AuthProvider`.
- `apps/web/src/components/ProtectedRoute.tsx` — redirects to `/login` if
  unauthenticated (never fires in mock mode).
- `apps/web/src/pages/LoginPage.tsx` — real Supabase email/password
  sign-in form. Lazy-loaded like every other page.
- `supabase/functions/invite-employee/index.ts` — Edge Function for real
  employee invites via the Auth admin API. Deploy with `supabase functions
  deploy invite-employee`; needs `SUPABASE_SERVICE_ROLE_KEY` set as a
  secret (never in client code).
- `apps/web/src/components/payments/VoidPaymentRecordButton.tsx` —
  replaces the old `DeletePaymentRecordButton`; soft-delete (void) instead
  of hard delete.
- `apps/web/src/hooks/use-void-payment-record.ts` — replaces
  `use-delete-payment-record.ts`.
- `supabase/migrations/0002_void_payment_records.sql` — adds the
  `voided_at` column.
- Test files (Vitest): `packages/modules/catalog/src/__tests__/
  mock-repository.test.ts`, `packages/modules/pos/src/__tests__/
  mock-repository.test.ts`, `packages/modules/booking/src/__tests__/
  mock-repository.test.ts`, `apps/web/src/lib/repositories/__tests__/
  mock-repository.test.ts`. Plus `apps/web/vitest.config.ts` (mirrors the
  `@` path alias from `vite.config.ts`).
- `apps/web/vite.config.ts` — now has a `build.rollupOptions.output.
  manualChunks` function. IMPORTANT: only splits libraries with ZERO React
  dependency (currently just `@supabase/supabase-js`) into their own
  chunk — see the code comment for why splitting React-dependent libs
  (tried once, reverted) breaks the app at runtime with a circular chunk.

### Never Include in Prompts
- `node_modules/` (any level) — build artifacts, never source.
- `.turbo/`, `dist/` — build output/cache.
- `.env`, `.env.local` — secrets.
- `pnpm-lock.yaml` — huge, auto-generated, never needs manual editing.
