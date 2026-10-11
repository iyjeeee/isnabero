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
reports) → Catalog → POS → Booking. Expenses and Inventory are now real modules
(Rounds 17 and 21); other `moduleKeyEnum` values (e.g. online_store) still have
no route/page/registry entry.

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
- Stock tracking is optional per offering (Round 21); `offerings.isAvailable`
  remains the manual sold-out toggle for untracked items.
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
- **Role enforcement** (recommendation #2) — originally `useHasRole`; since
  Round 17 replaced by the central permission map (`lib/permissions.ts`) +
  `useCan` / `usePermission` (`hooks/use-permission.ts`) — see Round 17.
  Gates management actions. Employees page: Add/Edit/Delete only render for owner/admin
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
  posOrders, posOrderItems, bookings, expenses), seeded to match `supabase/seed.sql`.
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
- `src/schema/expenses.ts` — `expenses` + `expenseCategoryEnum`. Include for
  expense work.
- `src/schema/audit.ts` — `auditLog` (append-only; actor name snapshot, action,
  entityType, entityId without FK, summary).
- `src/audit.ts` — `AUDIT_ACTIONS` (the closed list of audited events with
  entity + label), `getAuditActionLabel`, `auditPeso`. Triggers (0005) and
  mock repositories must use these exact action names/wording.
- `src/mock/audit.ts` — mock-mode logging: `setAuditActor` (set by
  AuthProvider), `recordAudit`, `auditRows` (kept out of `mockDb` on purpose).
- `src/schema/inventory.ts` — `stockItems` (PK `offeringId`; quantity,
  lowStockThreshold) and `stockMovements` (append-only ledger; `delta` ≠ 0,
  kind, note, referenceId), `stockMovementKindEnum`.
- `src/inventory.ts` — `STOCK_KINDS`, `MANUAL_STOCK_KINDS`, `MAX_STOCK_QUANTITY`,
  `stockStatus(qty, threshold)` (single source of ok/low/out), `InsufficientStockError`.
- `src/mock/stock.ts` — mock-mode `assertStockForSale` / `applyStockMove` (the
  Supabase equivalents are the 0006 trigger + `checkout_sale` RPC).
- `src/schema/scheduling.ts` — `shifts` (employee, `shiftDate` YYYY-MM-DD, `startTime`/`endTime` HH:MM wall-clock,
  note; cascades with the employee). `moduleKeyEnum` gained `scheduling`; `AUDIT_ACTIONS` gained `shift.created /
  updated / deleted` (entity "shift"). The mock store seeds this week + next (fixed pattern, no rng).
- Round 22: `businesses` gained `address`, `tin`, `contactNumber`, `receiptFooter` (all nullable) in
  `schema/core.ts`; `posOrders` gained `receiptNumber` (NOT NULL, unique per business) in `schema/pos.ts`.
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
- `migrations/0008_scheduling.sql` — see Round 23.
- `migrations/0007_receipts.sql` — see Round 22.
- `migrations/0006_inventory.sql` — see Round 21.
- `migrations/0002`–`0005` — void payment records; booking no-overlap;
  roles + expenses RLS (Round 17, re-shipped in Round 19 with payment-void and
  employee policies); audit log triggers (Round 19).
- `seed.sql` — demo business ("Sample Business", already set up) with
  catalog/pos/booking/expenses/inventory enabled, 7 offerings, 4 employees, opening stock for Sisig (24) and Lumpia (6), sample receipt details (address, phone, footer — no TIN), and two weeks of shifts relative to today; auto-applied on `supabase db reset`. Does
  NOT replicate the mock store's 21-day generated history. Safe to edit/clear.

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
- `src/components/trend-badge.tsx` — `TrendBadge`: up/down % vs previous
  period (null = neutral "No data" text). Used by Sales/Booking reports.
- `src/components/quantity-stepper.tsx`, `action-icon-button.tsx`,
  `pagination.tsx` — shared stepper, edit/delete table action button, pager.
- `src/index.ts` — package entry, re-exports all components + `cn`.
  **Every new component file MUST be added here** (a missing export crashes
  the importing page at runtime).

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
- `src/overlap.ts` — the no-overlap rule: `rangesOverlap` (half-open
  [start, end)), `blocksSlot` (cancelled doesn't block), `assertValidRange`,
  `BookingConflictError` (user-facing message naming the clashing booking).
  Used by BOTH repositories — never duplicate the rule elsewhere.
- `src/index.ts` — module entry (also exports `overlap.ts`).

### Module: Expenses — `packages/modules/expenses`
- `package.json` — `@isnabero/module-expenses`; same deps as the other modules.
- `src/categories.ts` — fixed `EXPENSE_CATEGORIES` (rent, utilities, supplies,
  salaries, other), `getExpenseCategoryLabel`. A test checks it equals
  `expenseCategoryEnum` in `packages/db`.
- `src/types.ts` — `Expense` (amount as number, `expenseDate` as YYYY-MM-DD),
  `CreateExpenseInput`, `ListExpensesOptions`.
- `src/validation.ts` — `normalizeExpenseInput` (used by BOTH repositories):
  category/method valid, trimmed description ≤120, notes ≤500, amount rounded
  to cents and ≥0.01 ≤9,999,999.99, real calendar date, not in the future.
  Also `todayYmd()`.
- `src/repository.ts` — `ExpensesRepository`: `listExpenses`, `createExpense`,
  `voidExpense` (deliberately no update/delete — financial history).
- `src/mock-repository.ts`, `src/supabase-repository.ts` (explicit row
  mapper), `src/get-repository.ts`, `src/hooks.ts` (`useExpenses`,
  `useCreateExpense`, `useVoidExpense`; query key `["expenses", businessId,
  includeVoided]`), `src/index.ts`.
- `src/__tests__/mock-repository.test.ts` — 15 tests.

### Module: POS receipts — `packages/modules/pos` (Round 22 additions)
- `src/receipt.ts` — `Receipt`, `ReceiptLine`, `ReceiptBusiness`, `ReceiptRef` (`{orderId}` or
  `{paymentRecordId}`), `formatReceiptNumber` (000123), `receiptRefKey`.
- `PosRepository.getReceipt(businessId, ref)` (null when no POS sale matches) in the mock and Supabase
  repositories; `CheckoutResult` now includes `receiptNumber`. Hook `useReceipt` (key
  `["receipt", businessId, ref]`).

### Module: Scheduling — `packages/modules/scheduling`
- `package.json` — `@isnabero/module-scheduling` (copy of the expenses setup); `tsconfig.json`.
- `src/types.ts` — `Shift`, `ShiftInput`, `UpdateShiftInput` (no employee: reassign by remove + add), `ListShiftsOptions`,
  `CopyWeekInput/Result`. `src/dates.ts` — YYYY-MM-DD helpers (`addDays`, `weekStartOf` Monday, `weekDays`, `isRealDate`).
- `src/validation.ts` — `normalizeShiftInput` / `normalizeShiftTimes` (real date; end after start; 15 min–16 h; same day;
  note ≤120), `shiftsOverlap` (touching is fine), formatters `formatClock`, `formatClockShort`, `formatHours`.
- `src/repository.ts` — `SchedulingRepository`: `listShifts`, `createShift`, `updateShift`, `deleteShift`, `copyWeek`.
- `src/mock-repository.ts` (logs audit), `src/supabase-repository.ts` (maps the 23P01 exclusion error; triggers audit),
  `src/get-repository.ts`, `src/hooks.ts` (`useShifts`, `useCreateShift`, `useUpdateShift`, `useDeleteShift`, `useCopyWeek`;
  key `["shifts", businessId, from, to]`), `src/index.ts`. `src/__tests__/scheduling.test.ts` — 13 tests.

### Module: Inventory — `packages/modules/inventory`
- `package.json` — `@isnabero/module-inventory` (copy of the expenses setup); `tsconfig.json`.
- `src/types.ts` — `StockLevel`, `StockMovementView`, `StartTrackingInput`,
  `AdjustStockInput`, `ListMovementsOptions`.
- `src/validation.ts` — `normalizeTracking`, `normalizeThreshold`,
  `normalizeAdjustment` (note required; restock/return > 0; damage < 0;
  correction any non-zero), `formatDelta`. Used by both repositories.
- `src/repository.ts` — `InventoryRepository`: `listStockLevels`, `listMovements`,
  `startTracking`, `stopTracking`, `setLowStockThreshold`, `adjustStock`.
- `src/mock-repository.ts` (logs audit), `src/supabase-repository.ts` (inserts
  only; triggers keep counts and audit), `src/get-repository.ts`, `src/hooks.ts`
  (`useStockLevels`, `useStockMovements`, mutations; all invalidate
  `["stock", businessId]`), `src/index.ts`.
- `src/__tests__/mock-repository.test.ts` — 12 tests.

### Web App — `apps/web`
- `package.json` — all app-level deps (react-router, react-hook-form, zod,
  supabase-js, tanstack table, etc.) plus workspace package links.
- `vite.config.ts` — Vite + React plugin, `@` path alias → `src`.
- `tailwind.config.cjs` — extends `packages/config` preset, sets content
  globs (app src + `packages/ui`). NOTE: `.cjs` extension required because
  `package.json` has `"type": "module"`.
- `eslint.config.js` — flat ESLint config (see "Code-quality fixes" round).
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
  of modules (catalog, pos, booking, expenses) with `label`, `description`
  (shown in the setup wizard), `path`, `icon`, optional `requires` (POS and
  Booking need Catalog) and optional `permission` (role gate for sidebar
  entry + route). Also exports `getModuleDefinition`, `normalizeModules`
  (adds required modules) and `dependentsOf`. `ModuleKey` must stay in sync
  with `moduleKeyEnum` in `packages/db/src/schema/core.ts` (a test checks it).
  Include whenever adding, renaming, or reordering a module.
- `src/lib/permissions.ts` — **`PERMISSIONS`**: the one role→permission map
  (`business.configure` owner; `employees.manage`, `payments.void`,
  `expenses.view`, `expenses.manage`, `audit.view` owner+admin), `hasPermission`. The
  database RLS in migration 0004 mirrors it — change both together.
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
- `src/hooks/use-void-payment-record.ts` — `useVoidPaymentRecord(businessId)`:
  calls `CoreRepository.voidPaymentRecord` (soft delete), invalidates payment
  records + dashboard stats.
- `src/hooks/use-permission.ts` — `useCan()` (checker; denies while auth or
  the employee role is still loading) and `usePermission(p)`. Replaced the
  deleted `use-has-role.ts`.
- `src/hooks/use-business.ts`, `use-save-business-setup.ts` — business row
  query and the setup-wizard save mutation.
- `src/hooks/use-pagination.ts` — `usePagination(items, pageSize)`.
- `src/hooks/use-media-query.ts` — `useMediaQuery(query)`; drives the sidebar's
  desktop-panel vs mobile-drawer behavior.

**`src/components/` — Reusable Feature Components**
- `src/components/catalog/CreateOfferingModal.tsx` — "Add offering" form
  (react-hook-form + zod): name, description, type, price, duration,
  dynamic bundle inclusions list (shown only when type = bundle). Shows a
  success toast on save. Include when changing what fields an offering can
  have.
- `src/components/catalog/offering-form-schema.ts` — `offeringFormSchema` +
  `OfferingFormValues`, split out of the modal so it is unit-tested. Blank
  Duration / inclusion Qty become `undefined` (→ null), NOT 0; duration and qty
  must be positive whole numbers. Tests: `__tests__/offering-form-schema.test.ts`.
- `src/components/pos/CheckoutModal.tsx` — payment method selector (cash/
  GCash/bank transfer/other) with conditional reference-code field. Include
  when changing checkout/payment-method behavior.
- `src/components/booking/NewBookingModal.tsx` — "New booking" form (same
  trigger/dialog pattern as `CreateOfferingModal`): package select,
  customer name, start time. Lives in Booking's `PageHeader` action slot,
  replacing what used to be an always-visible inline form.
- `src/components/employees/AddEmployeeModal.tsx` — "Add employee" form
  (react-hook-form + zod): full name + role select. Email field and email
  validation exist ONLY in supabase mode (real invite); mock mode creates a
  local record without an email. Shows a success toast on save.
- `src/components/employees/EditEmployeeModal.tsx` — pencil-icon trigger,
  pre-filled name/role form, calls `useUpdateEmployee`. Lives in the
  Employees table's Actions column.
- `src/components/employees/DeleteEmployeeButton.tsx` — trash-icon trigger
  + `ConfirmDialog`, calls `useDeleteEmployee`. Lives in the Employees
  table's Actions column.
- `src/components/payments/VoidPaymentRecordButton.tsx` — `Ban`-icon trigger +
  `ConfirmDialog`; voids (soft-deletes) a record, does NOT reverse the linked
  order/booking. Lives in the Payments Actions column (no Edit, deliberately).
- `src/components/reports/{Sales,Booking,Catalog}ReportSection.tsx` — the three
  Reports sections (recharts); Sales/Booking use `TrendBadge` +
  `computePercentChange` for period-over-period comparison.
- `src/components/ErrorBoundary.tsx` — class error boundary wrapping the route
  `<Outlet>` in `AppLayout` (keyed on pathname, so navigating away clears it):
  a crashing page shows an "Something went wrong" card + Try again while the
  sidebar stays usable.
- `src/components/PageFallback.tsx` — shared "Loading…" Suspense fallback
  (App.tsx for /login, AppLayout for pages).
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
  animation + `<ErrorBoundary>` + `<Suspense>` + `<Outlet>` wrapper for all
  authenticated routes (Suspense lives here so the sidebar stays mounted while
  a lazy page chunk loads).

**`src/pages/` — Screens**
- `src/pages/DashboardPage.tsx` — `PageHeader` + `StatCard` grid, plus
  three content cards: **Quick Actions** (links to enabled modules'
  primary action), **Getting Started** checklist (computed from real
  hook data: `useBusinessModules`, `useOfferings`, payment records,
  employee count), **Recent Activity** (last 5 payment records via
  `CoreRepository.listPaymentRecords`).
- `src/pages/PaymentsPage.tsx` — 3-stat summary row + `FilterBar` (search
  reference/source + method-filter tabs) + payment ledger table with an
  **Actions column (Void only via `VoidPaymentRecordButton`**, owner/admin
  only — no Edit, deliberately), "Show voided" checkbox, pagination, CSV export. Method column uses color-coded `Badge`; skeleton
  rows while loading; `EmptyState` for both "no data" and "no filter
  matches". Always-on, not a module page.
- `src/pages/EmployeesPage.tsx` — 3-stat summary row + `FilterBar` (search
  + role-filter tabs) + staff table with an **Actions column** (`Edit` via
  `EditEmployeeModal`, `Delete` via `DeleteEmployeeButton`). Role column
  uses color-coded `Badge`; skeleton rows; `EmptyState` for both empty and
  no-matches states. `AddEmployeeModal` in the `PageHeader` action slot.
- `src/pages/ReportsPage.tsx` — `PageHeader` + the Sales/Booking/Catalog
  report sections, rendered per enabled module (lazy-loaded; owns the recharts
  chunk).
- `src/lib/percent-change.ts` — `computePercentChange(current, previous)`;
  returns null when previous is 0 (no baseline). Tested in
  `src/lib/__tests__/percent-change.test.ts`.
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
- `src/pages/BookingPage.tsx` — window is today through the next 30 days
  (`UPCOMING_DAYS`), each card shows a date label for non-today bookings;
  "Today's Bookings" counts only today's. 3-stat summary row + `NewBookingModal` in
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
- `apps/web/src/lib/export-csv.ts` — `buildCsv(rows)` (pure, tested in
  `lib/__tests__/export-csv.test.ts`) + `exportToCsv(filename, rows)` download.
  Text cells starting with `= + - @` get a leading `'` (formula-injection
  guard); numbers untouched.
- `apps/web/src/providers/AuthProvider.tsx` — auth context (mock-mode
  synthetic session vs. real Supabase auth). Wraps the whole app in
  `App.tsx`.
- (`use-has-role.ts` was deleted in Round 17 — see `use-permission.ts`.)
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

### Round: Dashboard / Catalog / POS visual redesign
Request: these three pages were "plain and simple" — wanted more modern, clean,
aesthetic, visually appealing, and user-friendly. Approach: extend existing
design-system primitives (shared `packages/ui` components, existing shadow/
animation tokens in `tailwind.preset.js`) rather than one-off page styles, so
the same visual language (gradient icon tiles, type-accent tints) now shows up
consistently everywhere those components are used, not just on these 3 pages.

- `packages/ui/src/components/stat-card.tsx` — icon tile upgraded from a flat
  tint to a soft diagonal gradient (`bg-gradient-to-br` + `ring-1`) with a
  hover scale; value now uses `font-display`; added optional `helpText` slot
  for a secondary line under the value. Backward compatible — this
  automatically improves every page that already uses `StatCard`
  (Dashboard, Payments, Booking, Employees), not just Dashboard.
- `packages/ui/src/components/quantity-stepper.tsx` — new shared `+`/`-`
  quantity control (`QuantityStepper`), exported from `packages/ui/src/
  index.ts`. Replaces the raw number `<Input>` for cart-line quantity in POS;
  reusable anywhere else a line-item count needs editing later (Booking,
  Inventory).
- `apps/web/src/pages/DashboardPage.tsx` — greeting-based description
  ("Good morning/afternoon/evening — …"); Quick Actions rewritten as tinted
  icon-tile rows (success/info/default accents matching each module) instead
  of a plain bordered list; Getting Started now shows an actual progress bar
  (`width: ${percent}%`) above the checklist plus a success banner when
  complete; Recent Activity rows get a per-source icon circle (POS → cart
  icon, Booking → calendar icon) instead of bare text.
- `apps/web/src/pages/CatalogPage.tsx` — offering cards now lead with a
  type-accent icon tile (Box/Layers/PlusCircle for item/bundle/addon, same
  tint mapping as POS below); price promoted to a bold `font-display` primary-
  colored figure; inclusions changed from a bullet `<ul>` to wrapped pill
  chips; sold-out cards are dimmed (`opacity-70`) for an at-a-glance scan;
  card footer (availability badge + toggle button) pinned to the bottom via
  `mt-auto` so cards of uneven height still align.
- `apps/web/src/pages/PosPage.tsx` — item tiles now show the same type-accent
  icon tile as Catalog so an item's visual identity is consistent between the
  two screens; cart panel is `sticky top-6` so it stays in view while
  scrolling a long item grid; cart lines use the new `QuantityStepper`
  instead of a raw number input; added an item-count `Badge` next to "Current
  Sale"; empty cart now uses `EmptyState` instead of a plain paragraph; total
  enlarged to `text-lg font-bold` with the figure in `font-display` primary
  color to match Catalog's price treatment.
- Verified: `pnpm turbo run typecheck build test` all green; also rendered
  the built app with Playwright (light + dark, Dashboard/Catalog/POS, plus
  POS with items added to cart to confirm the stepper) — no layout breaks,
  dark mode gradients/tints hold up.
- Cleanup applied this round (carried over from a prior round's instruction
  that hadn't actually been executed yet): deleted the stale
  `apps/web/src/components/payments/DeletePaymentRecordButton.tsx` and
  `apps/web/src/hooks/use-delete-payment-record.ts` — both referenced the
  removed `deletePaymentRecord` repository method and were failing
  `typecheck`; `VoidPaymentRecordButton`/`use-void-payment-record` (soft-
  delete) are the only ones in use.

### New Files This Round
- `packages/ui/src/components/quantity-stepper.tsx` — `QuantityStepper`,
  exported from `packages/ui/src/index.ts`.

### Deleted Files This Round
- `apps/web/src/components/payments/DeletePaymentRecordButton.tsx`
- `apps/web/src/hooks/use-delete-payment-record.ts`
(ZIPs can't represent deletions — if applying this round's delta onto a copy
that still has these two files, delete them manually; they're dead code
referencing a removed repository method and will fail typecheck otherwise.)

### Round: Reports crash fix (TrendBadge export)
- **Root cause:** `packages/ui/src/index.ts` never exported `trend-badge.tsx`,
  so `SalesReportSection`/`BookingReportSection` failed at module load
  ("does not provide an export named 'TrendBadge'"), crashing the Reports
  route. Fix: added `export * from "./components/trend-badge";`.
- `apps/web/src/main.tsx` — `BrowserRouter` now sets `future` flags
  `v7_startTransition` + `v7_relativeSplatPath` (silences React Router v7
  warnings; no behavior change in current routes).
- Doc corrections: removed stale references to the deleted
  `DeletePaymentRecordButton`/`use-delete-payment-record`, "Coming soon"
  Reports, "Demo Cafe" seed; added TrendBadge/percent-change/use-media-query.
- Test count is now 25 (catalog 4, pos 3, booking 2, web 16).

### Round: Code-quality fixes
- **Per-package typecheck:** `"typecheck": "tsc --noEmit"` added to
  `packages/db`, `packages/ui`, and `packages/modules/{catalog,pos,booking}`
  `package.json`. `pnpm typecheck` (turbo) now checks all 6 packages
  independently, not just what `apps/web` imports.
- **ESLint:** new `apps/web/eslint.config.js` (flat config: `@eslint/js` +
  `typescript-eslint` recommended + `react-hooks` rules; ignores `dist` and
  `*.config.*`; `no-explicit-any` is off ONLY for
  `src/lib/repositories/supabase-*.ts` row mappers). Dev deps added to
  `apps/web/package.json`: `eslint@9`, `@eslint/js`, `typescript-eslint`,
  `eslint-plugin-react-hooks`, `globals`. `pnpm lint` passes with zero warnings
  (`--max-warnings 0`); confirmed it flags a deliberate unused variable.
  Run `pnpm install` after extracting (lockfile changed).
- **Global mutation error toasts:** `apps/web/src/main.tsx` builds the
  `QueryClient` with a `MutationCache.onError` that shows `toast.error` for any
  failed mutation (reads `.message` structurally because PostgREST errors are
  plain objects). Do NOT add per-call error toasts for mutations — it would
  double-toast; use per-call `onError` only for custom behavior.
- **POS cashier:** `PosPage.tsx` now passes `employee?.id ?? null` (from
  `useAuth()`) as `employeeId` in checkout, instead of always `null`.
- **Known open items (deferred):** see the "Bug-fix sweep" round below.

### Round: Bug-fix sweep
User direction: fix all errors first → then add the remaining roadmap
features → then a dedicated visual/design pass. Supabase mode stays LAST.
Bugs found by reading every page/component, each fixed and verified (unit
test and/or real-browser click-through):
1. **Add offering saved blank Duration/Qty as 0** (`z.coerce.number()` turns
   `""` into 0) → `offering-form-schema.ts` (see components list).
2. **POS: clearing the quantity box deleted the cart line** (stepper min was
   0) → `PosPage` passes `min={1}`; removal is the X button.
3. **POS: Checkout button stayed clickable during a pending sale (duplicate
   sale risk)** → `CheckoutModal` trigger disabled while `isPending`.
4. **Payments: filter bar (with "Show voided") was hidden when no active
   records, so voided ones couldn't be revealed** → bar always renders.
5. **Booking showed today only, so a booking for tomorrow vanished after
   creation** → today + 30 days with date labels; customer name is trimmed.
6. **Employees: last owner could be deleted/demoted** → `LAST_OWNER_MESSAGE`
   + guard in BOTH `mock-repository.ts` and `supabase-repository.ts`
   (`updateEmployee`/`deleteEmployee` throw; surfaced by the global mutation
   toast). Delete button hidden on your own row. Test added.
7. **CSV export formula injection** → see export-csv entry.
8. **No error boundary / whole layout replaced while a page chunk loaded** →
   `ErrorBoundary` + Suspense moved into `AppLayout`.
- Tests: 34 total (catalog 4, pos 3, booking 2, web 25).
- **Still open (deliberately deferred):** Supabase mode readiness (RLS write
  policies for employees/offering_inclusions/pos_order_items/payment_records
  update, missing 0000 migration, business resolution after login, first-owner
  bootstrap, edge-function caller auth) — LAST step; Reports fetch whole
  tables in Supabase mode (needs SQL views/RPC). Feature gaps (not bugs):
  booking status can't be changed after creation (always "pending"), no
  edit/delete for offerings or bookings. (Booking overlap rule: resolved in
  the next round.)

### Round: Booking no-overlap rule
**Business rule (decided by the user): two bookings can't share a time slot.**
Scope = the whole business (one bookable resource). Back-to-back is allowed
(end == next start); cancelled bookings free their slot.
- `packages/modules/booking/src/overlap.ts` (new) — shared helpers + 
  `BookingConflictError` (see Module: Booking).
- `mock-repository.ts` / `supabase-repository.ts` `createBooking` — validate
  the range, reject conflicts. Supabase also pre-checks with a query (friendly
  message) and maps DB error `23P01` (exclusion_violation) to
  `BookingConflictError` for the race case.
- `supabase/migrations/0003_booking_no_overlap.sql` (new) — `btree_gist`,
  `bookings_valid_range` CHECK (end > start) and `bookings_no_overlap`
  EXCLUDE constraint (business_id =, tstzrange(start,end) &&, where status <>
  'cancelled'). Apply order: 0000 (drizzle-generated) → 0001 → 0002 → 0003.
  **Verified against a real Postgres 16** (overlap rejected, back-to-back OK,
  other business unaffected, cancelled doesn't block, bad range rejected);
  NOT yet run through Supabase CLI / the app in supabase mode.
- UI: no component change needed — the global mutation error toast shows the
  conflict message and `NewBookingModal` stays open so the time can be
  changed. Verified in a real browser (overlap rejected, +20 min accepted).
- Tests: booking tests moved to far-future dates (2031/2032) so they can't
  collide with seeded bookings; 4 overlap tests added. Total **38** tests
  (catalog 4, pos 3, booking 6, web 25).
- Seed note: the mock seed creates ≤1 short booking/day, so it never
  self-overlaps. If seed generation changes, keep that true.
- Still open: booking status can't be changed after creation; no
  edit/delete for offerings or bookings; Supabase-mode readiness (LAST).

### Round 17: RBAC, setup wizard, expenses
**RBAC.** `lib/permissions.ts` (map above) → `hooks/use-permission.ts` →
`components/RouteGuard.tsx` (`permission?`, `moduleKey?`; permission checked
first, then a "module is turned off" screen linking owners to Business Setup).
Sidebar items and Dashboard quick actions are filtered by permission.
`PaymentsPage` uses `payments.void`, `EmployeesPage` uses `employees.manage`.
`business.configure` is owner-only (admin can't run setup) — one-line change.
Mock role switch: `VITE_MOCK_ROLE=owner|admin|staff` (mock mode only; typed in
`vite-env.d.ts`, documented in `.env.example`). `AuthProvider` derives
`employeeLoading` from a resolved user+business key (no "no role" flash) and
guards stale employee responses. `packages/db/src/mock/store.ts` exports
`DEMO_ADMIN_USER_ID` / `DEMO_STAFF_USER_ID` (match `supabase/seed.sql`).
**Setup wizard.** `businesses.setup_completed_at` (nullable; the demo business
is seeded as already set up). `pages/SetupPage.tsx` + `components/setup/`
(`SetupWizard` 3 steps Business → Modules → Review, `SetupSteps`,
`ModuleToggleList`; `Switch` added to `packages/ui` and exported).
`components/SetupGate.tsx` redirects an owner of a not-yet-set-up business to
`/app/setup` (setup route sits outside the gate). `CoreRepository` gained
`getBusiness` and `saveBusinessSetup` (rename, set every module's enabled flag,
stamp `setupCompletedAt` first time only; POS/Booking pull in Catalog).
Dashboard checklist step 1 = "Finish business setup". Sidebar has "Business
Setup" (owner).
**Expenses.** Schema `packages/db/src/schema/expenses.ts` (`expenses` table,
`expense_category` enum; void-only via `voided_at`). Mock seed appended AFTER
all other rng use so earlier seeded data is unchanged. Web:
`pages/ExpensesPage.tsx` (3 stat cards, category tabs, search, Show voided,
pagination, void action gated by `expenses.manage`),
`components/expenses/` (`AddExpenseModal`, `VoidExpenseButton`,
`expense-form-schema.ts` — amount kept as a string to avoid the
blank→0 coercion, `expense-stats.ts`) plus tests. Registered in
`MODULE_REGISTRY` (permission `expenses.view`), lazy route `/app/expenses`
inside `SetupGate` + `RouteGuard moduleKey="expenses"`, Dashboard quick action.
Reports do NOT include expenses yet (staff can view Reports).
**Migration** `supabase/migrations/0004_roles_and_expenses.sql` (NOT applied —
Supabase is last): `employee_has_role()` (security definer, fixed
search_path), owner-only update on `businesses`, owner-only `business_modules`
writes (replaces the 0001 policy), RLS on `expenses` for owner/admin (select,
insert, update; no delete policy) and a trigger allowing only `voided_at` to
change. Apply order 0000 → 0001 → 0002 → 0003 → 0004. **Verified on a real
Postgres 16** (baseline generated with drizzle-kit, `auth.uid()` stubbed,
non-superuser role): owner/admin can insert + void, amount edits and deletes
are blocked, staff see and insert nothing, admin can't rename the business or
toggle modules, cross-business insert/read blocked. NOT run through Supabase
CLI. `seed.sql` enables the expenses module.
**Verification.** typecheck, lint (0 warnings), build, tests all green.
Total **77** tests (catalog 4, pos 3, booking 6, expenses 15, web 49).
Playwright (owner/admin/staff): nav + quick action visibility, direct-URL
denial for staff, validation, add, search, category filter, void, Show voided,
future date rejected, no horizontal overflow at 390px. The "expenses turned
off" screen uses the generic `RouteGuard` module path (verified for other
modules) and was not separately exercised for expenses.
**After extracting this round's ZIP run `pnpm install`** (new workspace
package; `pnpm-lock.yaml` is included).

### Round 18: CSV data export
CSV only (PDF is batch 3). One shared UX: `components/ExportCsvButton.tsx`
(props `filenamePrefix`, `buildRows(range)`, `withDateRange?`, `hint?`,
`disabled?`). Without a range it downloads on click; with one it opens a dialog
(optional From/To, both inclusive, blank = everything; live row count; reversed
range shows an error; Download disabled at 0 rows; filename gets the range).
Exports respect each page's current filters/search/"Show voided".
- `lib/date-range.ts` — `toLocalYmd` (local day, not UTC), `inDateRange`,
  `validateDateRange`.
- `lib/export-rows.ts` — pure row builders (`paymentRows`, `expenseRows`,
  `bookingRows`, `offeringRows`, `employeeRows`, `salesReportRows`). Dates are
  local YYYY-MM-DD and times local HH:mm. The old Payments export used UTC ISO
  timestamps; it now uses these columns (Date, Time, Source, Method, Reference,
  Amount, Status). `lib/export-csv.ts` (formula-injection-safe) is unchanged.
- Wired into: Payments, Expenses, Booking (only the loaded today+30-day window),
  Catalog, Employees (owner/admin only, like the rest of that page's actions),
  Sales Report card (last 14 days of daily revenue). Booking and Catalog report
  cards have no separate export (the Booking/Catalog list exports cover them).
- Tests: `date-range.test.ts` (3), `export-rows.test.ts` (5). Total **85**
  tests (catalog 4, pos 3, booking 6, expenses 15, web 57).
- Playwright: direct downloads (Catalog, Employees), range dialog (count,
  disabled states, narrowing 20 → 5 rows, filename, CSV rows = count),
  Payments and Sales Report downloads, staff sees no Employees export.
  Booking export was only checked for the button's presence, not its content
  (covered by the unit test).

### Round 19: Audit trail
First item of batch 3 (agreed order: Audit trail → PDF export → Inventory →
Receipts (printable sales receipt with TIN/address fields, NOT claimed as
BIR-compliant) → Staff scheduling → Language toggle (English + Filipino) →
Offline resilience).
**What is logged** (`AUDIT_ACTIONS`): sale.completed, payment.voided,
booking.created, offering.created / availability_changed, expense.created /
voided, employee.created / updated / deleted, business.updated (rename or setup
completed), business.modules_changed (one entry per module flipped, by key).
No-ops are not logged (re-voiding, unchanged employee save, same availability);
rejected operations are not logged.
**Mock mode:** repositories call `recordAudit(...)` after a successful change;
the actor comes from `setAuditActor`, which `AuthProvider` sets to the signed-in
employee ("System" if none). Supabase repositories do NOT log — triggers do.
**Supabase mode:** `migrations/0005_audit_log.sql` — RLS (owner/admin read only,
no insert/update/delete policy so rows are permanent and unforgeable) and
security-definer triggers calling `audit_write()` (actor = employee matching
`auth.uid()`, else "System"; skips when the business is gone so a business
cascade delete still works). Summary wording mirrors the mock.
**UI:** `pages/AuditLogPage.tsx` at `/app/audit` (permission `audit.view`,
owner/admin; sidebar "Audit Log"): entity tabs, search, pagination, CSV export
with date range (`auditLogRows` in `lib/export-rows.ts`). `CoreRepository.
listAuditLog` (newest first, limit 500; read-only by design).
**Migration 0004 fix (found while testing 0005 on real Postgres):** 0001 had no
UPDATE policy on `payment_records` and no write policies on `employees`, so
voiding a payment and the app's employee update/delete would have been blocked
in Supabase mode. 0004 now adds owner/admin update on payment records (a trigger
freezes everything except `voided_at`) and owner/admin insert/update/delete on
employees. Re-apply 0004 from this ZIP (it was never applied anywhere).
**Verification:** typecheck, lint, build, tests green — **93** tests (catalog 5,
pos 4, booking 7, expenses 17, web 60). Real Postgres 16 (0000 baseline from
drizzle-kit, auth.uid() stubbed, non-superuser role): every action produced the
right entry with the right actor; no-ops logged nothing; owner couldn't
update/delete/forge audit rows; staff read 0 rows; staff couldn't void payments;
payment edits blocked; deleting a business still worked. Playwright (admin,
staff): nav/direct URL gating, empty state, entries by Maria Santos, tabs,
search, CSV, no mobile overflow.
Known limits: the mock log resets on reload (in-memory, like all mock data);
the last-owner rule is still app-level only (not a DB constraint); Supabase mode
overall is NOT yet run through the Supabase CLI.

### Round 20: PDF export
Batch 3 item 2. `components/ExportCsvButton.tsx` was **replaced** by
`components/ExportButton.tsx` (every page's "Export" now opens one dialog:
optional From/To where relevant, live row count, then **Download PDF** or
**Download CSV**). Props: `title`, `filenamePrefix`, `buildRows(range)`,
`withDateRange?`, `moneyColumns?` (PDF only), `hint?`, `disabled?`. Used by
Payments, Expenses, Booking, Catalog, Employees, Audit Log, Sales Report card.
- `lib/export-pdf.ts` — `buildPdf` (business name + title + range + generated
  time header, striped table, page numbers, landscape when > 6 columns, money
  columns right-aligned) and `formatPdfCell`. **Money is written "PHP 1,234.00"
  because PDF base fonts have no ₱ glyph.** jsPDF is imported on demand (its
  ~390 kB chunk isn't in the main bundle). Same rows as the CSV, so both stay
  in sync (`lib/export-rows.ts`).
- Dependencies added to `apps/web`: `jspdf` ^4.2.1, `jspdf-autotable` ^5.0.8
  (run `pnpm install`; `pnpm-lock.yaml` shipped). `pnpm-workspace.yaml` now
  has `allowBuilds: core-js: false` (its postinstall only prints a banner), which
  stops pnpm's "ignored build scripts" error.
- **Delete `apps/web/src/components/ExportCsvButton.tsx` by hand** after
  extracting (a ZIP can't delete files); nothing imports it any more.
- Fixed a Round 18 slip: the Catalog empty state wrongly got a (disabled)
  export button; it's back to just the Add offering button.
- Tests: `export-pdf.test.ts` (4: formatting, real multi-page %PDF output,
  orientation). Total **97** tests (catalog 5, pos 4, booking 7, expenses 17,
  web 64).
- Playwright: Catalog/Employees (no date inputs; CSV + PDF download), Expenses
  with date range (count, filename with range, dialog closes, empty range
  disables both buttons). One generated PDF was rendered and inspected visually.
  Not separately re-tested in the browser: PDF from Payments, Booking, Audit Log
  and Sales Report (same component and row builders, covered by unit tests).

### Round 21: Inventory
Batch 3 item 3 (next: Receipts → Staff scheduling → Language toggle → Offline
resilience).
**Model:** stock is a ledger (`stock_movements`) with a maintained count
(`stock_items`). Tracking is optional per offering, set up from the Inventory page
(not the Add-offering form). Whole-number counts. Bookable bundles (with
`durationMinutes`) can't be tracked. Inventory is its own module and `requires`
catalog. The manual Sold-out toggle still works for untracked items; tracked items
show out-of-stock via derived status (`isAvailable` is not written).
**Web:** `pages/InventoryPage.tsx` (`/app/inventory`, visible to all roles; stat
cards, All/Low/Out tabs, search, status table, Stock history with date-range
PDF/CSV export). Writes need the new permission `inventory.manage` (owner/admin):
`components/inventory/` (`TrackItemModal`, `AdjustStockModal`, `ItemSettingsModal`,
`StockBadge`, `inventory-form-schema.ts` + test). Also: POS tiles show "N left" /
"Out of stock", can't add beyond stock; Dashboard "Stock alerts" card; Catalog
`StockBadge`; Audit Log "Stock" tab; `stockRows` / `stockMovementRows` in
`lib/export-rows.ts`.
**Sale deduction:** mock `pos` repository checks stock before creating anything
(all-or-nothing) then writes `sale` movements. Supabase `pos` repository now calls
the `checkout_sale` RPC (prices read from the DB, cashier = `auth.uid()`).
Voiding a payment does NOT restock yet. Sale audit summary is now
`Sale of ₱X paid by METHOD` (no item count) in both modes.
**Audit:** new actions `stock.tracking_changed`, `stock.adjusted`.
**Migration** `supabase/migrations/0006_inventory.sql` (NOT applied to Supabase):
RLS (members read; owner/admin write; no `sale` movements from clients; ledger
immutable), `stock_items_guard` (count only changes via the movement trigger),
`stock_movements_apply` trigger, audit triggers, `checkout_sale` RPC (locks stock
rows, errcode 23514 on shortage). Verified on real Postgres 16 (baseline + 0001–
0006 + seed): sale deducts + audits; shortage/out-of-stock leave nothing behind;
staff can't forge movements or edit counts; oversell adjustment blocked; direct
quantity edit blocked. Not run through the Supabase CLI.
**Tests:** **120** total (catalog 5, pos 9, booking 7, expenses 17, inventory 12,
web 70). typecheck/lint/build green. Playwright (admin + staff): dashboard alerts,
stats, opening history, validation, track/adjust/oversell/damage/correction,
threshold, stop tracking, POS tile states and 7th-Lumpia block, checkout reduces
stock, CSV + PDF download, Catalog badges, Audit "Stock" entries, staff read-only,
no horizontal overflow at 390px (inventory, POS, catalog, dashboard, audit).
**Setup:** run `pnpm install` (new workspace package + lockfile).
Known limits: pre-existing — deleting a business that has POS sales fails in
Postgres because `pos_order_items.offering_id` is ON DELETE RESTRICT; reports don't
include stock; mock data resets on reload.

### Round 22: Receipts
Batch 3 item 4 (next: Staff scheduling → Language toggle → Offline resilience).
**What a receipt is:** a *sales receipt* for a POS sale — business name, address, phone, TIN (each only if set),
receipt number, date/time, cashier, lines (qty × name, unit price, amount), total, payment method + reference,
footer message, and the fixed line "This is a sales receipt, not an official receipt." **It is NOT BIR-compliant and
never claims to be** (no ORUS/permit/serial/VAT breakdown, no official-receipt series).
**Numbers:** sequential per business, shown as `000123`; voided sales keep theirs and print "*** VOIDED ***".
Mock: next = highest + 1 (`nextReceiptNumber` in the POS mock repo; seeded history is numbered oldest-first).
Supabase: `pos_orders_assign_receipt` BEFORE INSERT trigger (advisory lock per business) ignores whatever the client
sends; `pos_orders_freeze_receipt` blocks changing a number later.
**Receipt details** (address ≤200, TIN, phone ≤30, footer ≤120; all optional): edited by the owner
(`business.configure`) on **Business Setup** in a "Receipt details" card (shown after first-run setup only).
`validateReceiptDetails` / `normalizeReceiptDetails` / `formatTin` in `lib/repositories/repository.ts` (shared by
the form and both repositories; TIN = 9 or 12 digits, stored `123-456-789[-000]`).
`CoreRepository.saveReceiptDetails`; `BusinessView` has the four new fields. Audit: one "Receipt details updated"
entry (action `business.updated`, no values logged) — mock logs it, the 0007 trigger logs it in Supabase mode.
**UI:** `components/receipt/` — `ReceiptSheet` (the receipt, black-on-white), `ReceiptDialog` (Print + Download PDF),
`ReceiptDetailsCard`. The receipt dialog opens automatically after a POS sale, and Payment Records has a receipt
button on every POS row (all roles; Actions column now always shown). Printing: a hidden copy of the receipt is
rendered into `<body>` (`.receipt-print-root`, CSS at the end of `index.css`) and everything else is hidden under
`@media print`. `lib/receipt-pdf.ts` — 80 mm-wide one-page PDF (money as "PHP 1,234.00"; the page is never shorter
than 90 mm because jsPDF flips wider-than-tall pages to landscape). `lib/receipt-format.ts` — labels/formatters and
the disclaimer text. Hooks: `use-save-receipt-details.ts`; `use-void-payment-record.ts` also refreshes receipts.
**Migration** `supabase/migrations/0007_receipts.sql` (NOT applied to Supabase; idempotent): new columns, backfill
numbers oldest-first then NOT NULL + unique, the two triggers, audit trigger update, and `checkout_sale` now also
returns `receipt_number`. Verified on real Postgres 16 both on a fresh baseline (applied twice) and as an upgrade of a
DB with existing orders (backfill 1,2,3 by date); staff sale returns 1 then 2; a forged insert with number 999 got
the next number; changing a number is blocked; staff can't edit the business; one audit entry for a receipt-details
edit and none for a no-op save, TIN not in the log; two sessions selling at once got 32 distinct numbers 1..32.
**Tests:** **134** total (catalog 5, pos 15, booking 7, expenses 17, inventory 12, web 78). typecheck/lint/build
green. Playwright (owner, staff): details form validation + TIN reformat, receipt after sale (all fields), PDF
download + text, print media emulation (only the receipt, 1 page), voided stamp, receipt from Payments, audit entry,
staff can open receipts but not void or reach Business Setup, no horizontal overflow at 390px. The generated PDF
was rendered and inspected.
Known limits: receipts read the business's *current* details and offering names (no snapshot at sale time — fine
today since offerings can't be renamed, but a TIN edit changes reprints); only POS sales have receipts (not
bookings); the Supabase `getReceipt` query (PostgREST embeds) is written but not run against a real Supabase/
PostgREST; Print uses the browser's print dialog (thermal-printer paper size is chosen there).

### Round 23: Staff scheduling — CURRENT
Batch 3 item 5 (next: Language toggle (English + Filipino) → Offline resilience → visuals/design pass → Supabase last).
**Model:** a *shift* = one employee, one calendar day, start/end wall-clock times (no timezone). Same-day only (a night
shift is two shifts); 15 min–16 h; an employee can't have overlapping shifts (touching is fine). Weeks run Monday–Sunday.
**Permissions:** the module (`scheduling`, no `requires`) is visible to every role; `schedule.manage` (owner, admin) adds,
edits, removes and copies. Staff get a read-only grid. Removing an employee removes their shifts silently.
**UI:** `pages/SchedulePage.tsx` at `/app/schedule` (sidebar "Schedule"): week navigation + "This week", 3 stat cards
(shifts, hours, staff scheduled), `components/schedule/WeekGrid.tsx` (employees × Mon–Sun, "N working" per day, hours per
person, "You" badge, today highlighted; scrolls sideways inside its card on small screens), `ShiftModal.tsx` (add / edit /
remove; employee locked when editing), `shift-form-schema.ts`, `schedule-stats.ts` (`computeWeekStats`). "Copy last week"
repeats the previous week's shifts into the shown week and skips any that would overlap (toast reports both counts).
Export (CSV/PDF) of the shown week via `shiftRows` in `lib/export-rows.ts`. Audit Log has a "Shifts" tab.
**Audit:** created ("Scheduled X on date 09:00–17:00"), updated (only when day/time changes: "Changed shift for X: old →
new"), deleted ("Removed X's shift on …"). A note-only edit isn't logged. Mock logs it; triggers do in Supabase mode.
**Migration** `supabase/migrations/0008_scheduling.sql` (NOT applied; idempotent): `scheduling` enum value, `shifts` table,
CHECK on length, **exclusion constraint** `shifts_no_overlap` (btree_gist), RLS (members read; owner/admin write, employee
must be in the same business), freeze trigger (employee/business can't change), audit trigger (silent on employee cascade).
Verified on real Postgres 16 on a fresh baseline (applied twice), as an upgrade (table missing), and with seed: staff can read
but not insert/update/delete; overlaps blocked, touching and other employees fine; 10-minute, 17-hour and backwards shifts
blocked; another business's employee blocked; employee swap blocked; audit wording matches the mock; note-only edit not
logged; deleting an employee removed their 10 shifts with no shift audit entries; two sessions racing an overlapping shift —
one failed, one row stayed.
**Tests:** **155** total (catalog 5, pos 15, booking 7, expenses 17, inventory 12, scheduling 13, web 86). typecheck/lint/build
green. Playwright (owner, staff): seeded week stats (19 shifts, 152h, 4 of 4), add with prefilled employee, end-before-start
error, overlap refused, edit (employee locked), remove, CSV rows, week navigation, copy last week (19 copied, second copy 19
skipped), Audit "Shifts" entries, no page overflow at 390px, staff read-only with "You" badge.
**Setup:** run `pnpm install` (new workspace package + lockfile). Existing businesses need the `scheduling` row in
`business_modules` (turn it on in Business Setup).
Known limits: no time-off/availability, no overnight shifts, no shift swaps or publishing/notifications; the Supabase
repository has not been run against a real Supabase/PostgREST.

### Never Include in Prompts
- `node_modules/` (any level) — build artifacts, never source.
- `.turbo/`, `dist/` — build output/cache.
- `.env`, `.env.local` — secrets.
- `pnpm-lock.yaml` — huge, auto-generated, never needs manual editing (but it IS shipped in a round's ZIP when dependencies changed).
