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
- `migrations/0000_initial_schema.sql` — **added in Round 27**: the CREATE TYPE / CREATE TABLE statements, generated from the
  Drizzle schema with `drizzle-kit generate` (they were missing, so 0001 would have failed on a fresh project). Runs first.
- `migrations/0009_lock_down_functions.sql`, `0010_restock_on_void.sql`, `0011_booking_status.sql`, `0012_offering_edit.sql`, `0013_admin_configure.sql` (Round 28: admin may update `businesses`/`business_modules`) —
  see Round 27.
- `HOSTED-SETUP.md`, `link-owner.sql` — step-by-step for a hosted Supabase project, and the script that links a real login to
  the seeded owner (Round 27).
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
  directly. Round 27 adds `useUpdateOffering` and `useDeleteOffering`.
- `src/rules.ts` — `OfferingInUseError` / `OFFERING_IN_USE_MESSAGE` (Round 27): both repositories throw it when
  deleting an offering that sales or bookings still reference.
- `CatalogRepository` also has `updateOffering` and `deleteOffering` (Round 27; Supabase uses the `update_offering()` RPC).
- `src/index.ts` — module entry (also exports `rules.ts`).

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
- `src/status.ts` (Round 27) — the booking lifecycle: `BOOKING_STATUSES`, `nextStatuses`, `canTransition`, `isEditable`,
  `BookingStatusError`, `BOOKING_NOT_EDITABLE_MESSAGE`. pending → confirmed → completed; pending/confirmed → cancelled;
  completed/cancelled are final. Migration 0011 enforces the same table in the database.
- `BookingRepository` also has `updateBooking` (open bookings only; re-checks the slot excluding itself) and
  `updateBookingStatus`; hooks `useUpdateBooking`, `useUpdateBookingStatus`.
- `src/index.ts` — module entry (also exports `overlap.ts` and `status.ts`).

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
  (`business.configure` owner+admin since Round 28; `employees.manage`, `payments.void`,
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
  tenant context (`businessId`, `businessName`). **Mock mode defaults to the
  seeded demo business** ("Sample Business", `DEMO_BUSINESS_ID` from
  `@isnabero/db`); **Supabase mode starts empty** and `AuthProvider` sets it
  from the signed-in user's employee row (Round 27, `getMembership`) and
  clears it on sign-out (`clearBusiness`). `setBusiness`
  should then be called with the logged-in employee's actual business_id.
- `src/stores/theme-store.ts` — `useThemeStore` (Zustand): light/dark mode
  state. Persists to `localStorage` (`isnabero-theme` key), toggles the
  `.dark` class on `<html>`. Works together with the inline script in
  `index.html` (avoids theme-flash on load).

- (Removed in Round 39: `src/stores/language-store.ts` — the app is English only; there is no language state or choice.)

**`src/i18n/` — UI text (English only since Round 39; built in Round 24)**
- `locale.ts` (`LOCALE = "en-PH"`, used by Intl for dates/times), `translate.ts` (`translate(dictionary, key, params)`, `msg`/`decodeMessage`
  form-message tokens, `flattenKeys`, types derived from the English dictionary), `use-t.ts` (`useT` returns a constant `{ t, tm, locale }`;
  `translateNow` for code outside React), `format.ts` (`useFormat` dates/times), `use-labels.ts` (`useLabels`: enum labels — role, method,
  booking status, stock kind, audit action…), `index.ts`. All UI text still goes through `t("area.key")`; there is no second language.
- `locales/en/*.ts`, one file per area: common, nav, ui, errors, modules, enums, dashboard, payments, reports, employees, setup, auth,
  catalog, pos, receipt, booking, expenses, schedule, inventory, audit, exports, app, plus others (see the folder).
- `__tests__/i18n.test.ts` (no empty strings, well-formed placeholders/plurals, module and audit-action coverage, translate/msg),
  `__tests__/hardcoded-text.test.ts` (AST scan of every TSX for untranslated JSX text, text attributes, toasts and literals in JSX expressions).

**`src/lib/offline/` — Offline read cache (Round 25)**
- `query-persistence.ts` (save/restore the TanStack Query cache to localStorage `isnabero-offline-cache`, 24 h max age, version-checked,
  `claimCacheForUser`, `clearOfflineCache`, debounced `startQueryPersistence`), `serialize.ts` (JSON that keeps `Date` objects),
  `register-service-worker.ts` (production only); `public/sw.js` (app-shell service worker); `components/OfflineBanner.tsx`,
  `components/OfflineCacheGuard.tsx`, `hooks/use-online-status.ts`; strings in the `offline` namespace.

- `src/lib/money.ts` — `formatPeso` / `formatAmount`: the one way pesos are shown (₱18,713.00). Use it instead of `toFixed(2)`.
- `src/hooks/use-offline-unavailable.ts` + `components/OfflineUnavailable.tsx` — shown instead of a page whose data was never loaded while offline.

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
  calls `CoreRepository.voidPaymentRecord` (soft delete; a POS payment also
  restocks its items — Round 27), invalidates payment records, dashboard
  stats, receipts, stock and reports.
- `src/hooks/use-permission.ts` — `useCan()` (checker; denies while auth or
  the employee role is still loading) and `usePermission(p)`. Replaced the
  deleted `use-has-role.ts`.
- `src/hooks/use-business.ts`, `use-save-business-setup.ts` — business row
  query and the setup-wizard save mutation.
- `src/hooks/use-pagination.ts` — `usePagination(items, pageSize)`.
- `src/hooks/use-media-query.ts` — `useMediaQuery(query)`; drives the sidebar's
  desktop-panel vs mobile-drawer behavior.

**`src/components/` — Reusable Feature Components**
- `src/components/catalog/CreateOfferingModal.tsx` — the "Add offering" button plus `OfferingFormModal` in create mode.
- `src/components/catalog/OfferingFormModal.tsx` (Round 27) — the offering form for BOTH add and edit (react-hook-form + zod):
  name, description, type, price, duration, dynamic bundle inclusions list (shown only when type = bundle). Controlled
  (`open`/`onOpenChange`, optional `offering` = edit). Include when changing what fields an offering can have.
- `src/components/catalog/OfferingActions.tsx` (Round 27) — edit + delete buttons on a catalog card (delete uses `ConfirmDialog`;
  a used offering shows the repository's error toast). Include with `CatalogPage.tsx`.
- `src/components/catalog/offering-form-schema.ts` — `offeringFormSchema` +
  `OfferingFormValues`, split out of the modal so it is unit-tested. Blank
  Duration / inclusion Qty become `undefined` (→ null), NOT 0; duration and qty
  must be positive whole numbers. Tests: `__tests__/offering-form-schema.test.ts`.
- `src/components/pos/CheckoutModal.tsx` — payment method selector (cash/
  GCash/bank transfer/other) with conditional reference-code field. Include
  when changing checkout/payment-method behavior.
- `src/components/booking/NewBookingModal.tsx` — the "New booking" button
  plus `BookingFormModal` in create mode (Round 27: the form itself moved to
  `BookingFormModal.tsx`, shared with edit). Lives in Booking's `PageHeader`
  action slot.
- `src/components/booking/BookingFormModal.tsx` (Round 27) — the booking form for BOTH create and edit (package, customer, optional
  contact, start time); an edit keeps the booking's length unless the package changed. `booking-form.ts` holds the pure helpers
  (`toDateTimeLocal`, `bookingMinutes`; tested in `booking/__tests__/booking-form.test.ts`).
- `src/components/booking/BookingActions.tsx` (Round 27) — per-booking buttons: Confirm / Mark completed, edit, cancel (with
  `ConfirmDialog`); renders nothing for completed/cancelled bookings. Include with `BookingPage.tsx`.
- `src/components/NoBusinessAccess.tsx` (Round 27) — screen for a signed-in account that belongs to no business.
- `src/lib/repositories/paginate.ts` (Round 27) — `fetchAllRows`: reads every page past Supabase's 1000-row cap; used by the paged
  Supabase queries (payment records, sales/booking/catalog reports). Tested in `__tests__/paginate.test.ts`.
- `src/lib/repositories/__tests__/void-sale.test.ts` (Round 27) — restock-on-void behaviour (mock).
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
- (`LanguageSwitcher.tsx` was removed in Round 39.) `src/providers/UiLabelsBridge.tsx` feeds translated labels to `packages/ui` (`ui-labels.tsx`: `UiLabelsProvider`/`useUiLabels`, English defaults).
- `src/components/ThemeToggle.tsx` (REMOVED in Round 32; theme now chosen in `SettingsDialog.tsx`) — sun/moon icon button, calls
  `useThemeStore`. Lives in the Sidebar footer.

**`src/layouts/` — Shell**
- `src/layouts/Sidebar.tsx` — dark navy surface (via `sidebar-*` tokens,
  NOT the main `background` token) with a branded header (icon + business
  name), grouped nav from `lib/nav-config.ts` and a collapse toggle (theme, language, sign out and Business Setup moved to `TopBar.tsx` in Round 31). Active nav item gets a
  solid maroon (`primary`) background; hover states have icon scale + slide
  micro-animations. Include whenever changing sidebar behavior, colors, or
  the core nav list.
- `src/layouts/TopBar.tsx` — navy top bar (same `sidebar-*` tokens as the sidebar): Settings icon (opens `components/SettingsDialog.tsx`) and Sign out icon (+ hamburger and business name on mobile). Include with Sidebar/AppLayout for shell changes.
- `src/layouts/AppLayout.tsx` — Sidebar + TopBar + fluid-width content container
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
  unauthenticated (never fires in mock mode); shows `NoBusinessAccess` when the
  account has no employee row (Supabase mode, Round 27).
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
`business.configure` is owner+admin as of Round 28 (admin == owner in permissions.ts; RLS mirrored in `0013`).
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

### Round 23: Staff scheduling
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

### Round 24: Language toggle (English + Filipino) — HISTORY ONLY: Filipino and the toggle were removed in Round 39 (see below)
Batch 3 item 6 (next: Offline resilience → visuals/design pass → Supabase last).
**Behaviour:** a language button (EN/FIL) sits next to the theme toggle in the sidebar footer and on the login page. The choice is
remembered (`isnabero-language`); first visit follows the browser (fil/tl → Filipino, otherwise English). Dates, weekdays and times
follow the language (`useFormat`); `<html lang>` is `en-PH` / `fil-PH`. Numbers and ₱ formatting are unchanged.
**Architecture:** custom typed i18n, no new dependency (see `src/i18n/` above). English is the source of truth; Filipino is typed
against it. Use `const { t, tm } = useT()`; plurals are `"1 item|{count} items"` with `t(key, { count })`; placeholders `{name}`.
Zod schemas are built at import time, so they use `msg("area.key")` tokens and forms render them with `tm(error.message)`. Stored enum
values are never changed; display labels come from `useLabels()`. Shared components in `packages/ui` get strings through
`UiLabelsProvider` (Pagination, QuantityStepper, dialog Close, ConfirmDialog, TrendBadge).
**Adding a string (current rule, English only since Round 39):** add the key to `locales/en/<area>.ts` only, use `t(...)`. (Originally also `locales/fil/<area>.ts`.) The tests fail if the key is
empty, a `{placeholder}` is malformed, or JSX contains untranslated English.
**Stays English on purpose:** error messages thrown by the modules/db, audit-log summary text (stored in rows, written by DB
triggers in Supabase mode), the printed receipt, receipt PDF and CSV/PDF exports (content and file names), data users type
(item names, notes), brand/acronyms (Isnabero, POS, PDF, CSV, GCash, TIN).
**Filipino style:** natural business Taglish — keep common loanwords (stock, booking, receipt, cash, GCash, setup, add-on); glossary:
Employees = Mga Empleyado, Payment Records = Mga Tala ng Bayad, Reports = Mga Ulat, Catalog = Katalogo, Inventory = Imbentaryo,
Expenses = Mga Gastos, Schedule = Iskedyul, Void = I-void. The owner reviews wording via the review CSV (all keys, English, Filipino);
change a phrase by editing `locales/fil/<area>.ts` only.
**Tests:** **166** total (web 97). typecheck/lint/build green. Playwright (owner): default English, switch to Filipino, persistence
across reload, `<html lang>`, every page in Filipino with no leftover English apart from the intentional list above, modals and
validation messages (employees, checkout, booking, expense, stock, shift, offering), setup wizard, delete/void confirms, receipt dialog
(chrome Filipino, receipt English), no overflow at 390px on every page, English pages unchanged.
Known limits: error toasts coming from the data layer stay English; the printed receipt is English only; the staff role was not
re-walked in Filipino (same components, role gating untouched); machine-checked for consistency, but wording has not been
reviewed by a native speaker yet.

### Round 25: Offline resilience (read-only)
Batch 3 item 7, the last batch-3 feature (next: visuals/design pass → Supabase last).
**What it does:** when the browser goes offline an amber banner says so and that selling, saving and other changes are paused; coming
back shows a "Back online" toast and React Query refetches. Every change (all go through `useMutation`) is refused up front by the
global `MutationCache.onMutate` in `main.tsx` with a clear toast, instead of queuing (stock and receipt numbers are assigned by the
server, so queued sales would be wrong). Reading still works: successful query data is saved to localStorage (debounced) and restored
on start-up, so reloading the page offline still shows the last data; an offline reload also needs the app itself, which a small
service worker (`public/sw.js`, production builds only) provides — navigation is network-first with the last `index.html` as fallback,
hashed `/assets/*` are cache-first, other origins (the Supabase API) are never touched.
**Details that matter:** `onlineManager.setOnline(navigator.onLine)` at start (React Query assumes online until it sees an event);
`gcTime` is 24 h so earlier pages stay in memory; queries with data are saved even if a background refetch failed; mutations use
`networkMode: "always"` so they never pause silently. The saved cache belongs to one user: `OfflineCacheGuard` wipes it on sign-out
or when a different user signs in, and it is ignored after 24 h or on a version change. Storage errors (private mode, full) are swallowed.
**Switch:** always on in Supabase mode; in mock mode only with `VITE_OFFLINE_CACHE=true` (mock data lives in memory and re-seeds on
reload, so it would only confuse); see `.env.example`.
**Tests:** **175** total (web 106). typecheck/lint/build green (eslint now knows the service-worker globals for `public/sw.js`). Unit:
Date round-trip, save/restore, only data-bearing queries, max-age/version expiry, corrupt/blocked storage, user switch and sign-out
wipe. Playwright on a production build (`vite preview`): service worker active, banner only when offline, change refused with toast and
not applied, **reload while offline renders the app and the cached data** (a record that only existed in the pre-reload session),
navigating to other lazy pages offline, banner in Filipino, no overflow at 390px, back-online toast, live refetch replaces cached data.
Known limits: not tried against a real Supabase (a session whose token expired while offline may need a connection to refresh — the
app then shows the login page); pages never opened before going offline stay on their loading skeleton; no offline selling or queued
changes (a larger, separate step); the service worker has no update prompt (a new build is picked up on the next online load);
Google Fonts are not cached (system fonts are used offline).

### Round 26: Offline follow-up + design pass
Batch 3 is finished; this round is the agreed visuals/design pass (next: Supabase setup, last).
**Offline follow-up (found by the owner's screenshot):** offline with nothing loaded, pages used to show misleading zeros/empty states. Now
`useOfflineUnavailable` (queries that are paused with no data) swaps the page for "This page isn't available offline" (the page stays
mounted but hidden so it resumes on reconnect), and the receipt dialog says an unopened receipt isn't available offline instead of "not
found". What works offline: opened pages, search/filters/pagination, theme/language, CSV/PDF export of loaded data, building a POS cart,
printing/PDF of receipts opened before. What does not: every change (refused with a toast), never-opened pages/receipts, sign-in/out.
**Design pass (screenshot audit of all 12 pages × light/dark/mobile):** the app was already consistent, so the pass fixed concrete
problems instead of restyling: (1) **money formatting** — Payments, Dashboard, Reports, POS, Catalog showed `₱18713.00` while Expenses
showed `₱25,501.00`; all now go through `lib/money.ts` (tested); (2) **StatCard** no longer truncates long values (the Booking
"Next booking" date was cut to "Wed, Oct 14 · 12…"; it wraps now), centres its content when a row stretches, and is more compact below
`sm` (smaller icon/padding/value) so three stat cards take less of a phone screen. Not changed on purpose: payment-method badge colours
match the chart colours (bank transfer = brand maroon); the sidebar and design tokens are untouched.
**Tests:** **177** total (web 108). typecheck/lint/build green. Playwright: offline "page not available" notice (never-opened page) vs
cached page vs back online, receipt dialog offline (unopened → message, opened before → works), booking stat row alignment, full page
screenshots before/after in light, dark and 390px.
Known limits: the design pass is a consistency/bug audit by screenshot, not a visual redesign; say which pages or components to restyle
further.

### Round 27: Foundations + daily-use gaps (hosted Supabase prep)
Decision: Supabase will be a **hosted project** (not `supabase start`). Nothing has been run against it yet; the sandbox cannot reach
`supabase.co`. This round did the work that needs no live project: it tested the migrations on a scratch Postgres 16 (with stubs for
`auth.uid()` and the `anon`/`authenticated` roles, mimicking Supabase's default function grants), fixed what that found, and built the
four features that change the data model, so the schema is settled before real data exists.
**Found by testing the SQL on a real Postgres (all fixed):**
1. **No `0000` migration** — the tables were never created by any file. Generated `0000_initial_schema.sql`.
2. **Forgeable audit log** — Supabase grants EXECUTE on public functions to `anon`/`authenticated` and PostgREST exposes them as
   `/rest/v1/rpc/<name>`, so anyone could call the security-definer `audit_write` and write audit rows for any business. `0009` revokes
   it (triggers still work; they run as the owner). `checkout_sale` is also closed to `anon`.
3. **Bundles with inclusions could not be added** — 0001 had no write policy on `offering_inclusions`, so the client insert was blocked
   by RLS. `0012` adds one.
Confirmed OK on Postgres: staff can't read expenses/audit or edit the business; owners can; tenants are isolated; checkout RPC
(stock, receipt numbers, oversell → 23514); booking overlap (23P01); receipt joins return the right shape.
**Foundations:** (a) **Business from login** — `CoreRepository.getMembership(userId)` (mock + Supabase) returns the user's oldest employee
row and its business; `AuthProvider` loads it as a query (so the offline cache restores it) and sets `useBusinessStore`; mock mode
still starts on the demo business. An account with no employee row sees `NoBusinessAccess` instead of an empty app. Multi-business
switching is not built (the oldest membership wins). (b) **Reports/lists vs the 1000-row cap** — `lib/repositories/paginate.ts`
(`fetchAllRows`) pages through PostgREST's `max_rows`; the sales report reads previous + current period in one paged query, the booking
report uses head-only count queries for totals, and the catalog report no longer sends every order id in the URL (that broke past a few
hundred orders) — it reads `pos_order_items` with a `pos_orders!inner` join filtered by business and non-voided status.
**Restock on void:** voiding a POS payment marks its order `voided`, returns tracked items to stock as `return` movements ("Sale #N
voided") exactly once, and logs `stock.adjusted`. Mock: `voidMockSale()` in `packages/db/src/mock/stock.ts` (called from the core mock
repo); Supabase: trigger `payment_records_restock_void` (`0010`). Also fixes voided sales still counting in "top sellers".
**Booking status + edit:** `status.ts` lifecycle (above); `updateBooking` / `updateBookingStatus` in both repositories; UI: status badge,
Confirm / Mark completed button, edit and cancel actions per booking card (`BookingActions`, shared `BookingFormModal` for create and
edit with a new optional contact field; edit keeps the booking's length unless the package changes — `booking-form.ts`). Cancelled
bookings free their slot. DB: `0011` adds the `bookings_guard` trigger (legal moves only, final bookings frozen) and audit actions
`booking.status_changed` / `booking.updated`. Everyone in the business may do this (no new permission).
**Offering edit + delete:** `updateOffering` / `deleteOffering` in both repositories; UI: edit and delete buttons on catalog cards
(`OfferingActions`, shared `OfferingFormModal`). Delete is refused with a clear message when sales or bookings use the offering
(`OfferingInUseError`; Postgres foreign key 23503). Supabase edit goes through the `update_offering()` RPC (`0012`: one transaction
for details + inclusions + audit). Audit actions `offering.updated` / `offering.deleted` (delete is a BEFORE DELETE trigger; the
cascade's own "Stopped tracking" line is skipped). Past sales keep the price they were sold at (`pos_order_items.unit_price`).
New audit actions are in `AUDIT_ACTIONS` and both `enums.auditAction` locales.
**Tests:** **201** total (web 118). typecheck / lint / build green. Playwright on the dev server (mock mode): add → edit → delete an
offering, delete of a used offering refused with the toast, booking create → edit → confirm → cancel, no horizontal overflow at 390px.
SQL: migrations 0000–0012 + seed applied in order to a fresh Postgres 16; 0009–0012 each exercised with `authenticated`/`anon` roles.
**NOT verified:** anything through a real PostgREST/GoTrue (embeds in `getReceipt`, `getMembership`, the paged reports, RPC argument
mapping for `update_offering`), the login flow, expired-session-while-offline, `invite-employee`, RLS with real JWTs. Filipino strings for
this round were written without a native-speaker review (add them to `isnabero-translations-review.csv`).
**Findings left as-is (decide before go-live):** (1) an admin can set any employee's role, including to `owner` (and promote
themselves) — `employees` RLS allows owner/admin updates; the UI/last-owner rule is app-level only. (2) `createEmployee` still inserts
a random placeholder `user_id`; real users need the `invite-employee` edge function or manual linking. (3) The seed runs triggers, so a
fresh database starts with ~50 "System" audit rows (shift.created etc.). (4) Deleting an offering also deletes its stock history.
**Hosted setup:** see `supabase/HOSTED-SETUP.md` (create project, apply 0000–0012 + seed, create the first user, run `link-owner.sql`,
set `.env.local`). Open items not done: edit/cancel for expenses, reports including expenses/stock, offline selling, service-worker update prompt.

### Never Include in Prompts
- `node_modules/` (any level) — build artifacts, never source.
- `.turbo/`, `dist/` — build output/cache.
- `.env`, `.env.local` — secrets.
- `pnpm-lock.yaml` — huge, auto-generated, never needs manual editing (but it IS shipped in a round's ZIP when dependencies changed).

### Round 28: Admin = owner, Filipino review, invite hardening
- `apps/web/src/lib/permissions.ts`: `business.configure` is now `["owner","admin"]`, so admin has every permission an owner has
  (test loops all permissions). `supabase/migrations/0013_admin_configure.sql` mirrors it in RLS (`businesses` update,
  `business_modules` all). Verified on scratch Postgres: admin can update both, staff cannot. Last-owner protection is still app-level.
- Filipino accuracy pass over all 655 strings (`i18n/locales/fil/*.ts`): fixed inverted `auth.mockModeError`, "puwede" spelling,
  "Magbenta", length-limit wording ("Hindi dapat lumampas sa {max} na karakter"), "pagtatapos" for shift end, `modules.inventory.description`
  grammar, `inventory.adjust.countedQuantity`, export/PDF wording. Still needs a native-speaker read before launch.
- `supabase/functions/invite-employee/index.ts`: now verifies the caller's JWT and that they are an owner/admin of `businessId`
  (previously trusted the request body). NOT verified against a real Supabase (no access from the sandbox).
- Employee login IDs: employees sign in with their own email (Supabase Auth); `employees.user_id` links to `auth.users`.
  Recommended: keep email login, use the invite flow; no custom usernames.

### Round 29: Supabase-mode bug fix, sidebar regroup, detail dialogs, Playwright e2e
- **Bug fixed — Supabase mode never activated.** `packages/db/src/data-source.ts` read `(import.meta)?.env`; Vite only replaces the literal
  `import.meta.env.VITE_DATA_SOURCE`, so the optional-chained form read `undefined` and `getDataSource()` always returned `"mock"`
  (no login page, "Sign out" toast, sample data). Now uses the literal form (cast kept for typing; try/catch still covers plain Node).
  Regression-tested by `e2e/supabase/login-gate.spec.ts`.
- Mock mode is now obvious: a "Sample data" badge under the business name; the mock sign-out toast explains how to switch to Supabase.
- Sidebar (`layouts/Sidebar.tsx`, config in `lib/nav-config.ts`): groups by task — Dashboard; Sales (POS, Booking, Payment Records);
  Products & Stock (Catalog, Inventory); Team (Employees, Schedule); Money & Reports (Expenses, Reports, Audit Log). Empty groups hide.
  **Business Setup** is pinned at the bottom (settings, not daily work). `nav.core/modules/noModules` removed; `nav.groups.*`, `nav.demoMode*`,
  `nav.mainNavigation` added. `lib/__tests__/nav-config.test.ts` checks every registered module appears exactly once.
- Detail dialogs: `components/details/` — `DetailDialog` (shared label/value layout), `open-props.ts` (`openProps` makes a `<tr>`/card open on
  click/Enter/Space; ignores inner buttons and portal events; `OPEN_CLASS`), and Payment/Employee/Expense/Audit/Booking/Offering/Stock(+Movement)
  dialogs. Wired into Payments, Employees, Expenses, Audit Log, Inventory (items + history), Booking cards, Catalog cards. i18n namespace `details.*`.
- Richer rows: `PaymentRecordView` gained `summary`, `receiptNumber`, `cashierName`, `customerName` (mock: from mockDb; Supabase:
  `fetchPaymentDetails` in `supabase-repository.ts`, chunked `.in()` on pos_orders/bookings, best-effort — NOT verified against real PostgREST).
  Payments table has a Details column and searches it; CSV export gained Details/Customer/Cashier. Expenses show "Recorded by"; inventory shows item type;
  booking cards show price + contact; employees show a "You" tag.
- Playwright e2e (`apps/web/playwright.config.ts`, `apps/web/e2e/`): projects `owner` (mock, :5199), `mobile`, `staff` (VITE_MOCK_ROLE=staff, :5198),
  `supabase` (:5197; fake URL login-gate test, plus `live.spec.ts` that only runs with `E2E_LIVE=1 E2E_EMAIL E2E_PASSWORD` and only reads/signs in/out).
  `fixtures.ts` fails any test on console errors / uncaught exceptions / same-origin HTTP errors; use `goTo()` (sidebar click) after changing mock data —
  `page.goto` reloads and resets the in-memory mock DB. Commands: `pnpm --filter @isnabero/web e2e`, `e2e:live`. First run: `pnpm exec playwright install chromium`.
  Sandbox: `PW_CHROMIUM_PATH`, `PW_NO_SANDBOX=1`. Vitest now only includes `src/**/*.test.*`.
- Deps added to apps/web devDependencies: `@playwright/test` 1.56.0, `@types/node` ^22 (pnpm-lock.yaml updated).
- File map: new `src/lib/nav-config.ts`, `src/components/details/*`, `src/i18n/locales/{en,fil}/details.ts`, `e2e/*`; see FILE entries above for the pages touched.

### Round 30: offline selling, cash close, dashboard, change calculator, customers, expense edit + profit, barcode/shortcuts, update prompt, invites
New migrations (apply in order after 0013; all verified on a scratch Postgres 16, NOT on hosted Supabase yet): `0014_offline_sales.sql`,
`0015_cash_close.sql`, `0016_expense_edit.sql`, `0017_barcode.sql`. New e2e specs: offline-sales, cash-close, dashboard-and-change, customers,
expense-edit-profit, pos-scan, supabase/set-password.

1. **Offline selling.** `pos_orders.client_id` (+ unique index per business) and `checkout_sale(p_business, p_method, p_reference, p_lines, p_client_id, p_sold_at)`:
   a repeated client id returns the existing sale (`duplicate: true`); `p_sold_at` backdates (clamped to now). Web side `apps/web/src/lib/offline-sales/`:
   `types.ts` (PendingSale), `queue-store.ts` (zustand persist, localStorage key `isnabero-pending-sales`; `pendingQuantities`), `classify.ts`
   (`isConnectionError`: network/expired-JWT = retry, server refusal = park), `sync.ts` (`syncPendingSales`: oldest first, one run at a time, refused sale
   parked as "failed", connection error stops the run), `hooks.ts` (`useOfflineSalesSync` mounted in `AppLayout`; `useCheckoutOrQueue` used by `PosPage`;
   `usePendingByOffering`). `components/pos/PendingSalesBar.tsx` lists waiting/refused sales (retry/discard). Waiting units are subtracted from the
   stock shown at the till. Cash Close is blocked while sales wait. The global MutationCache offline guard is untouched (the POS no longer uses `useCheckout`).
   Text: `offlineSales.*`; `offline.message` updated. Not verified: real PostgREST/JWT-refresh behaviour while offline.
2. **Cash close.** Table `cash_closes` (RLS: members read; written only by `close_cash()`), `cash_close_summary()`, `cash_totals()`; expected = starting cash
   + cash sales − cash expenses since the previous close (period by `created_at`; voided excluded); audit `cash.closed`. Page `pages/CashClosePage.tsx`
   (route `/app/cash-close`, Sales group, all roles), `components/cash/CashDifferenceBadge.tsx`, `components/details/CashCloseDetailDialog.tsx`,
   `hooks/use-cash-close.ts`; core repository gained `getCashCloseSummary/closeCash/listCashCloses` (+ `expectedCash`, `validateCashAmounts`).
   Mock rows in `packages/db/src/mock/cash-closes.ts`; schema `packages/db/src/schema/cash.ts`. Limit: a sale that commits after a close started but is
   stamped earlier is missed (rare); offline sales are why close is blocked while any wait on this device.
3. **Dashboard.** `DashboardStats.yesterdaySalesTotal` (yesterday up to the same time of day); Today's Sales card shows TrendBadge + amount;
   `components/dashboard/TodayBookingsCard.tsx` (booking module on). Stock alerts card already existed.
4. **Change calculator.** `CheckoutModal`: "Cash received" box (cash only), quick amounts, change due / still owed, confirm blocked while short.
   Not stored with the sale. Pure helpers `lib/cash-change.ts`.
5. **Customers.** No table: `lib/customers.ts` (`groupCustomers`, matched by contact else name) over all bookings; `pages/CustomersPage.tsx`
   (route `/app/customers`, requires Booking module — `NavEntry.requiresModule`), `components/details/CustomerDetailDialog.tsx`; text `customers.*`.
6. **Expenses.** `ExpensesRepository.updateExpense` (active only; audit `expense.updated` with what changed; migration 0016 replaces the "only void" trigger:
   active rows editable, voided rows frozen, recorded_by/created_at never change). UI: `ExpenseFormDialog` (add + edit), `EditExpenseButton`.
   Profit: `lib/profit.ts` (`buildProfitReport`), `ReportsRepository.getProfitReport`, `components/reports/ProfitReportSection.tsx` (Expenses module on + `expenses.view`).
   "Cancel" = the existing Void (unchanged).
7. **Barcode + shortcuts.** `offerings.barcode` (unique per business, case-insensitive; `update_offering` gained `p_barcode`); catalog form field; module rules
   `normalizeBarcode`, `DUPLICATE_BARCODE_MESSAGE`. POS: `lib/barcode-scan.ts` (`findByBarcode`, `createScanBuffer`, scanner = keys < 80 ms apart + Enter),
   `hooks/use-pos-shortcuts.ts` (scan when no field focused, `/` focus search, F9 checkout; inactive while a dialog is open); Enter in the search box adds a
   barcode match or the only result. Mock demo codes: Sisig 4800001000011, Lumpia 4800001000028.
8. **Update prompt.** `public/sw.js` no longer self-activates; build stamps `BUILD_ID` (plugin `stampServiceWorker` in `vite.config.ts`); `lib/offline/update-store.ts`,
   `register-service-worker.ts` (checks every 30 min and on tab focus), `components/UpdateBanner.tsx` (in `AppLayout`): "Update now" / "Later".
   Verified in a real browser against `vite build` + `vite preview`.
9. **Invites.** `supabase/functions/invite-employee/index.ts` rewritten: CORS + OPTIONS, validation, caller must be owner/admin, `redirectTo` = `SITE_URL` or request
   Origin + `/set-password`, duplicate-email message, removes the new login if the employee row fails. Client: `lib/invite-error.ts` shows the function's real message;
   `pages/SetPasswordPage.tsx` (public route `/set-password`). `AddEmployeeModal` already used the invite flow in Supabase mode (mock mode still creates locally).
   NOT verified: the function itself (no Deno here; syntax-checked only) and the email/link flow on a real project.

### Round 31: top bar + no sidebar scrollbar
- New `layouts/TopBar.tsx` (rendered by `AppLayout` above the banners, all screen sizes): right side holds **Business Setup** (link to `/app/setup`, gated by
  `business.configure`, label hidden below `sm`), `LanguageSwitcher`, `ThemeToggle`, and new `components/SignOutButton.tsx` (same demo-mode toast as before).
  Left side (mobile only): hamburger + business name — this replaces the old inline mobile bar in `AppLayout`.
- `layouts/Sidebar.tsx` now holds only the header, grouped nav and the collapse toggle (settings row and theme/language/sign-out footer removed).
  `ThemeToggle`/`LanguageSwitcher` defaults changed from sidebar tokens to the main-surface tokens (they live on the light/dark top bar now).
- Sidebar scrollbar: the nav list uses the `no-scrollbar` utility (`src/index.css`): still scrolls by wheel/touch/keyboard but never draws a bar.
- Tests: `e2e/navigation.spec.ts` (Business Setup in `<header>`, new scrollbar test at 1280x420); `e2e/pos-scan.spec.ts` now fires scans in one tick (`scan()`),
  since keystroke-by-keystroke typing could exceed the 80 ms scan gap on a busy machine. Unused i18n key `nav.theme` remains (harmless).

### Round 32: sidebar-styled top bar with settings modal, compact page sizing (the max-width cap was replaced in Round 33)
- Top bar (`layouts/TopBar.tsx`) now uses the sidebar's navy tokens and shows only two icons: Settings and Sign out (`components/SignOutButton.tsx`).
  Settings opens `components/SettingsDialog.tsx`: Language (English/Filipino, `aria-pressed` buttons), Theme (Light/Dark via `useThemeStore.setTheme`), and a
  Business Setup link (gated by `business.configure`, closes the modal on click). `components/ThemeToggle.tsx` was deleted (unused); `LanguageSwitcher` stays for
  the login / set-password pages. i18n: `nav.settings`, `settingsHint`, `themeLight`, `themeDark`, `setupHint` added; `nav.switchToDark/Light` removed.
- Compact sizing principle (applies to every page): the content column in `AppLayout` is `mx-auto max-w-6xl` (1152px) with `px-4 py-5 sm:px-6 sm:py-6`;
  `PageHeader` is `p-4 sm:p-5`, h1 `text-xl sm:text-2xl`, icon 40px; `CardHeader`/`CardContent` default to `p-5` (use `p-0` for edge-to-edge tables; do NOT use
  responsive padding defaults, they beat unprefixed overrides); page roots use `space-y-5`; POS/report grids `gap-4`. Narrow focus pages keep their own cap
  (`SetupPage` `max-w-2xl`, `CashClosePage` `max-w-4xl`). Dashboard: Today's bookings and Stock alerts sit side by side (`lg:grid-cols-2`, hidden when empty).
  Booking "Next booking" stat value uses a smaller font so the date doesn't wrap.
- Tests: `language-and-theme.spec.ts` rewritten for the modal; `navigation.spec.ts` (top bar shows only Settings + Sign out; compact-width test); `setup.spec.ts`,
  `staff/staff-role.spec.ts`, `mobile/mobile.spec.ts` updated; `pos-scan.spec.ts` uses the one-tick `scan()` helper in both tests.

### Round 33: Business Setup as a modal, full-width pages, aligned headers
- **Business Setup is a modal, not a page.** `components/setup/BusinessSetupDialog.tsx` (mounted in `AppLayout`) holds `SetupWizard` (now flat, takes `onDone`) and, after
  first-run, `components/receipt/ReceiptDetailsForm.tsx` (was `ReceiptDetailsCard`; no Card wrapper). Open state: `stores/setup-dialog-store.ts` (`useSetupDialogStore`).
  Opened from Settings (`SettingsDialog`), the dashboard checklist step "Finish business setup" (`action` instead of `to`), and the "module is off" screen in `RouteGuard`.
  First run: the dialog opens by itself once per page load for an owner/admin whose business has `setupCompletedAt === null` (replaces the old forced redirect;
  `SetupGate.tsx` and `pages/SetupPage.tsx` were deleted). `/app/setup` still exists as `components/setup/SetupRedirect.tsx`: goes to `/app` and opens the modal
  (staff: the dialog renders nothing). `SETTINGS_ENTRY` in `lib/nav-config.ts` no longer has a `path`. Copy: `setup.review.later` now says Settings → Business Setup.
- **Full-width content.** The `max-w-6xl` cap from Round 32 is gone: `AppLayout` content is `w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8`. Wide screens get more columns instead of
  side gutters: Catalog grids `repeat(auto-fill,minmax(18rem,1fr))`; POS `lg:grid-cols-[minmax(0,1fr)_22rem]` with tiles `auto-fill minmax(11rem,1fr)`; Cash Close form and
  history side by side (`xl:grid-cols-[2fr_3fr]`); Booking cards 2 per row on `xl`; Profit "where the expenses went" in 2 columns on `lg`; dashboard bookings + stock alerts share a row.
- **Top bar / sidebar alignment.** Both headers are `h-16` with `border-white/10` lines, and the sidebar has a right border, so the lines run across the screen. The sidebar header
  is now icon + "Isnabero" + business name only; the "Sample data" badge moved to the top bar (`components/DemoBadge.tsx`).
- Tests: `setup.spec.ts` (modal, `/app/setup` redirect), `navigation.spec.ts` (full width, header heights equal, bookings/stock share a row), `staff-role.spec.ts`, `language-and-theme.spec.ts`.
  First-run auto-open was checked by hand with the mock business temporarily set to not-set-up (not an automated test).

### Round 34: Receipt details as the last Business Setup step
- `components/setup/SetupWizard.tsx` now has 4 steps: Business, Modules, Review, **Receipt details**. The last step's button ("Finish setup") validates the receipt fields
  (`validateReceiptDetails`), saves name + modules (`useSaveBusinessSetup`), then saves the receipt details (`useSaveReceiptDetails`) only if they changed, then toasts and closes.
  Invalid receipt fields keep the modal on step 4. `components/receipt/ReceiptDetailsForm.tsx` is now a controlled fields-only component (`value`, `errors`, `onChange`) with no
  save button; `BusinessSetupDialog.tsx` no longer renders it under the wizard. i18n: `setup.steps.receipt` added; `receipt.details.title/submit/saved` removed; setup descriptions updated.
- Tests: `e2e/setup.spec.ts` (receipt fields absent on steps 1-3, invalid TIN keeps step 4 open, values persist next time); `navigation.spec.ts` bookings/stock row check now polls (was flaky).

### Round 35: Automated database integration tests
- New `apps/web/integration/` (vitest, `*.int.ts`, run with `pnpm --filter @isnabero/web test:integration`, config `apps/web/vitest.integration.config.ts`, sequential files; plain `pnpm test` ignores them). They build the app's real `createSupabase*Repository(client)` objects with supabase-js clients and hit a real Supabase/PostgREST — nothing mocked.
  - `harness.ts` (`getContext()`, `repos(client)`, `tag()`; logs in with INT_EMAIL/INT_PASSWORD, or mints JWTs from INT_JWT_SECRET + INT_*_ID for local stacks), `load-env.ts` (reads `.env.integration` / `.env.local`), `README.md` (setup).
  - Suites: `catalog` (barcode uniqueness, bundles, delete-in-use), `sales` (inventory, checkout, idempotency, backdating, stock limits, dashboard, void restores stock), `expenses-cash` (validation, void, cash close math and next period), `booking-scheduling` (overlaps, status lifecycle, shifts, copy week; random far-future dates per run so reruns are safe), `people-security` (employees + last owner, membership, receipt/setup save, audit log is append-only, signed-out sees nothing, other business blocked, staff blocked from owner actions — the last two run only when outsider/staff logins are supplied).
- `supabase/e2e-test-business.sql` creates the isolated "E2E Test Business" the tests write to (records tagged `[E2E]`; sold/voided records remain as history by design). `.gitignore` adds `.env.integration`; `tsconfig.json` includes `integration`; `supabase/HOSTED-SETUP.md` has a new section.
- Verified: 28/28 pass (twice in a row) against a local Postgres 16 + PostgREST 12.2.3 with all migrations 0000–0017; tsc + eslint clean; unit 152 pass. Later run by the user against the HOSTED project: 28/28 pass (one earlier run had a single network `fetch failed`, fixed by the Round 36 retry).
- Finding: `voidPaymentRecord` on a record the user's role may not void silently updates 0 rows (RLS) instead of throwing; the UI hides the button for staff, data stays safe.

### Round 36: Hosted test run green, void error, harness retry, stale-file cleanup
- Hosted integration run: 28/28 pass against the user's Supabase (needs `apps/web/.env.integration` with the REAL `INT_EMAIL`/`INT_PASSWORD`; the placeholder `you@example.com` gives "Invalid login credentials"; `e2e-test-business.sql` must use the same email).
- `integration/harness.ts`: every client now uses `retryingFetch` (up to 3 attempts, 400ms/800ms backoff, only for a dropped connection `TypeError`; HTTP errors are never retried). The minted-JWT clients keep it too.
- `src/lib/repositories/supabase-repository.ts` `voidPaymentRecord`: now `.select("id")` and throws `errors.cannotVoid` (en + fil in `i18n/locales/*/errors.ts`) when 0 rows were updated (RLS silently filters a forbidden row). The global mutation toast shows the message. `integration/people-security.int.ts` staff test now expects the rejection. New unit test `src/lib/repositories/__tests__/void-payment-record.test.ts` (3 tests, stub client).
- `integration/load-env.ts`: BOM regex uses `\uFEFF` (the literal invisible characters failed `no-irregular-whitespace`).
- DELETED (stale; were removed in Rounds 32-34 but ZIPs cannot carry deletions): `src/components/ThemeToggle.tsx`, `src/components/receipt/ReceiptDetailsCard.tsx`, `src/pages/SetupPage.tsx`. Nothing imported them; they only broke `tsc`.
- Verified in the sandbox: tsc clean, eslint clean, unit 155 pass (was 152). NOT verified: the retry logic itself (no failing network to exercise) and the new void error against hosted Supabase.

### Round 37: Phone-layout pass
- Checked every page at 390px (and POS at 360px) in mock mode with Playwright screenshots: no page scrolls sideways; wide tables/tab strips scroll inside their own container. The Reports payment-method pie renders (the blank pie seen earlier was only the chart animation).
- `src/pages/PosPage.tsx`: item grid is 2 columns on phones (`minmax(9rem,1fr)`, `sm:` keeps the old `minmax(11rem,1fr)`); item names wrap to 2 lines (`line-clamp-2`) instead of truncating.
- `src/components/setup/ModuleToggleList.tsx`: the "Needed by ..." badge wraps as a tidy block (`whitespace-normal rounded-lg text-left`) with a small gap under the title row.
- `e2e/mobile/mobile.spec.ts`: new test "POS shows two items per row on a phone".
- Left as is (judged fine): one stat card per row on phones (long peso values need the width), horizontally scrolling tab strips (clipped last tab is the scroll hint), table pages scroll inside a container, two-line "SAMPLE DATA" badge in the top bar.
- Verified in the sandbox: tsc clean, eslint clean, unit 155 pass, Playwright 21 passed (mobile, POS, POS scan, setup, offline sales, language/theme) plus the new mobile test. NOT verified: real phone hardware, dark theme and Filipino text on phone width, hosted mode.

### Round 38: Dark theme + Filipino phone check
- Checked every page and the Settings / Business Setup / New booking dialogs at 390px in dark theme + Filipino (screenshots plus an off-screen-control scan). No page scrolls sideways; dark contrast looked fine.
- `packages/ui/src/components/page-header.tsx`: the action area is `max-w-full` and its button row wraps (`[&>div]:flex-wrap`), so long Filipino labels ("Magdagdag ng Empleyado") no longer run off the card. Applies to every page that passes `action`.
- `src/pages/SchedulePage.tsx`: the Copy last week / Add shift button group is `flex-wrap` ("Kopyahin ang nakaraang linggo" + "Magdagdag ng shift" ran off screen).
- `e2e/mobile/mobile.spec.ts`: new test "Filipino header and schedule buttons stay on screen".
- Known, left as is: row action buttons (edit/remove on Employees, receipt/void on Payments) sit in a horizontally scrolling table, so on a phone they need a sideways scroll to reach (same in English). A mobile card layout for those tables is a possible future round.
- A red border on one stat card in dark screenshots was only the hover state under a simulated pointer, not a bug.
- Verified in the sandbox: tsc clean (web + ui), eslint clean (web), unit 155 pass, Playwright 27 passed (mobile, schedule, employees, language/theme, booking, expenses, catalog, inventory). NOT verified: real phone hardware, hosted mode, other phone widths in dark/Filipino (only 390px).

### Round 39: Filipino removed — English only
- The app is English only. Removed: the Filipino dictionary (`src/i18n/locales/fil/`), the language toggle in the Settings modal and on the login / set-password pages (`components/LanguageSwitcher.tsx`), the language state (`stores/language-store.ts`, saved key `isnabero-language`, browser-language detection), `i18n/languages.ts`, `i18n/dictionaries.ts`, and the `language.*` / `nav.language` text. A previously saved Filipino choice in a browser is simply ignored.
- Kept: the whole `t("area.key")` text system (every screen uses it) — now backed by the English dictionary only (`locales/en`), so all text stays in one place and the hardcoded-text test still guards it. `useT()` returns a constant `{ t, tm, locale }` (no `language` field); `translate(dictionary, key, params)` lost its fallback-dictionary argument; `LOCALE = "en-PH"` (`i18n/locale.ts`) drives Intl dates/times; `<html lang="en">` is static in `index.html`.
- `SettingsDialog.tsx` now shows Theme (Light/Dark) and the Business Setup link; `nav.settingsHint` = "Appearance and business setup."
- Tests: `i18n.test.ts` rewritten (no Filipino parity/detection; checks empty strings, placeholders/plurals, module + audit coverage, translate/msg); `shift-form-schema.test.ts` uses the new `translate` signature; `e2e/language-and-theme.spec.ts` (name kept) now checks the Settings modal has theme + Business Setup and NO language choice and `<html lang="en">`; the Filipino mobile test from Round 38 was removed. Earlier rounds above that mention Filipino/`fil` describe history, not the current app.
- Verified in the sandbox: tsc clean, eslint clean, unit 153 pass (was 155: Filipino parity/detection tests removed, 2 English checks added), Playwright 74 passed + 2 skipped (the live-Supabase specs), screenshot of the Settings modal with a stale saved Filipino choice (loads English). NOT verified: hosted mode in a real browser, a production build (`vite build`) in this round.

### Round 40: Phone card layout for all list tables
- New shared CSS pattern `stack-table` (`apps/web/src/index.css`, `@media (max-width: 639px)`): a `<table className="stack-table …">` becomes one card per row below `sm`. The `<thead>` stays for screen readers only (visually hidden); each `<td data-label={t("…")}>` shows its label on the left (`td::before`), a `<td>` WITHOUT `data-label` (the actions cell) spans the card under a divider. Desktop/tablet (>= `sm`) is unchanged. No new component or dependency.
- Applied to every list table: the four with row action buttons (`pages/EmployeesPage.tsx`, `pages/PaymentsPage.tsx`, `pages/ExpensesPage.tsx`, `pages/InventoryPage.tsx` stock levels) and the read-only ones (`pages/CustomersPage.tsx`, `pages/AuditLogPage.tsx`, `pages/CashClosePage.tsx` history, `pages/InventoryPage.tsx` stock history). Labels reuse the existing column-header keys. To use it on another table: add the class and a `data-label` on every non-action `<td>`.
- Left as is: `components/schedule/WeekGrid.tsx` (a calendar grid, not a list; still scrolls inside its container).
- Tests: `e2e/mobile/mobile.spec.ts` gained 6 tests (Employees, Payments, Expenses, Inventory: first row is a block card and its action button is inside the 390px viewport; Customers and Audit Log: card rows, every cell labelled, no sideways page scroll). The Audit test records an expense first (mock audit log starts empty) and polls, because the list can re-render right after navigation.
- `components/SetupGate.tsx` (unused leftover from before Round 33) was deleted by the user.
- Verified in the sandbox: tsc clean, eslint clean, unit 153 pass, Playwright 79 passed + 2 skipped (live Supabase specs; the mobile project also passed 3 times in a row under 3 workers), production `vite build` OK (before the read-only tables were added), light + dark screenshots at 390px of Employees, Payments, Expenses, Inventory and light of Customers and Inventory history with no page-level sideways scroll. NOT verified: the Cash Close history cards visually (mock history starts empty; same CSS), the Audit Log cards in a screenshot (covered by the e2e test), real phone hardware, hosted mode in a real browser, screen-reader behaviour of the card layout (`display:block` on table parts can drop table semantics in some browsers).

### Round 41: New sign-in screen + sign-out confirmation
- **Sign-in screen** (`pages/LoginPage.tsx`) rebuilt on a shared frame `components/auth/AuthShell.tsx` (also used by `pages/SetPasswordPage.tsx`). Large screens: navy brand panel (sidebar tokens, so it stays dark in both themes) showing six module tiles with on/off switches (POS, Booking, Catalog, Inventory lit; Expenses, Schedule off) — the product's real "switch on what you need" idea; the lit tiles animate on one after another once on load (CSS in `index.css`: `.auth-panel`, `.auth-tile`, `.auth-switch`, `.auth-knob`; the lit state is the static style, so `prefers-reduced-motion` just shows it lit). Right column: a dot-grid backdrop (`.auth-surface`) with the form on a receipt-style sheet (`.auth-sheet`: maroon top edge, torn bottom edge, drop-shadow on `.auth-sheet-wrap`) (two more sheets peek out behind it) holding a left-aligned form with email/lock icons, show/hide password button (`aria-pressed`, labels `auth.showPassword/hidePassword`), error in a `role="alert"` box, spinner on the button, "ask your owner for an invite" line. Under the sheet, three facts about the app (`auth.facts.*`, `FACTS` in `AuthShell.tsx`): sales keep working offline, access by role, every change in the audit log — each is a real feature (Rounds 17, 19, 30). Phones: the panel is hidden and the brand sits above the form. Auth logic is unchanged (`signInWithPassword`, mock-mode guard, navigate to `/app`).
- **Sign-out confirmation**: `components/SignOutButton.tsx` now opens the shared `ConfirmDialog` ("Sign out of Isnabero?", default-colour confirm button, locked while signing out). It also adds a warning when sales are still queued on this device (`useOfflineSalesStore`). Demo mode still shows the explanatory toast, no modal (there is no session). `components/NoBusinessAccess.tsx` keeps its own direct "Sign out" button (unchanged).
- Text: `auth.title/tagline/showPassword/hidePassword/needAccess/panel.*`, `nav.signOutConfirm.*`.
- Tests: new `e2e/supabase/login-page.spec.ts` (panel + 4 lit/2 unlit tiles, password reveal, failed sign-in alert, phone layout); `login-gate.spec.ts` and `live.spec.ts` use `getByLabel("Password", { exact: true })` (the eye button's label also contains "Password") and `live.spec.ts` confirms the sign-out modal. The sign-out modal itself is only reachable with a real session, so it is covered by the live spec (skipped without `E2E_LIVE=1`) and was checked by hand with a temporary mock-mode override that was reverted.
- Verified in the sandbox: tsc clean, eslint clean, unit 153 pass, Playwright 84 passed + 2 skipped (live specs), screenshots of the sign-in screen (light, dark, 390px, first frame of the animation, zoom on the torn edge) and of the modal. NOT verified: the live sign-in/sign-out against hosted Supabase, the modal with queued offline sales, real phone hardware.

### Round 42: Owner role guard + forgot password
- **Owner role guard** — new migration `supabase/migrations/0018_owner_role_guard.sql` (apply after 0017; `HOSTED-SETUP.md` now says 0000 to 0018). Trigger `employees_owner_guard` (before insert/update/delete on `employees`): when a signed-in app user acts (`auth.uid()` not null) only an OWNER may add an owner, change a row's role to/from owner (or its `user_id`/`business_id`), or delete an owner; admins still manage admin and staff rows and may rename an owner. A business always keeps at least one owner (also enforced here now, not only in the app; skipped when a cascade removes the whole business, `pg_trigger_depth() > 1`). Service role / SQL editor / migrations (`auth.uid()` null) are not restricted, so `supabase/functions/invite-employee/index.ts` now refuses an `owner` invite from a non-owner caller (it selects the caller's role). Errors: 42501 "Only an owner can …", 23514 "A business needs at least one owner."
- App side: `lib/permissions.ts` `assignableRoles(actorRole)` (owner: staff/admin/owner; admin: staff/admin) and `canManageEmployee(actorRole, targetRole)`; `AddEmployeeModal` / `EditEmployeeModal` only offer assignable roles; `EmployeesPage` hides edit/remove on an owner's row for admins. Round 28's "admin has every permission an owner has" is unchanged (the `PERMISSIONS` map has no owner-only entry); this rule is about the owner ROLE itself. Closes finding (1) of Round 27.
- **Forgot password** — `pages/ForgotPasswordPage.tsx` (public route `/forgot-password`, lazy in `App.tsx`, same `AuthShell`): `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/set-password })`; success screen says "If <email> has an account…" (never reveals whether it exists) with "Use a different email"; errors (e.g. rate limit) show Supabase's message in an alert. `LoginPage` has a "Forgot password?" link beside the Password label. The emailed link opens the existing `/set-password` page (supabase-js reads the recovery session from the address). `setPassword.expired` text now covers both invite and reset links. Supabase needs `<site>/set-password` in Authentication → URL Configuration → Redirect URLs (same as invites).
- Text: `auth.forgot.*`; tests: `e2e/supabase/forgot-password.spec.ts` (link and back link, failed request alert, success state with the recover call stubbed), `e2e/supabase/set-password.spec.ts` text updated, 2 new unit tests in `lib/__tests__/permissions.test.ts`.
- Verified in the sandbox: migrations 0000–0018 applied in order on a scratch Postgres 16 (stubs for `auth.uid()` and the Supabase roles) and the guard exercised as admin / owner / outsider / superuser: admin promoting self or others to owner, adding an owner, demoting or deleting an owner all refused; admin managing staff and renaming an owner allowed; owner promoting/demoting another owner allowed; sole owner demoting or deleting self refused; deleting a whole business still cascades; no-JWT (service role) changes allowed. tsc clean, eslint clean, unit 155 pass, Playwright 87 passed + 2 skipped (live specs), production build OK, screenshots of the sign-in link and reset screens. NOT verified: migration 0018 on the hosted project (apply it in the SQL editor), the reset email and link against real Supabase, the invite function change (no Deno here), the Employees screens with an admin login (no automated admin e2e project exists), and the integration suite does not yet test the guard (it needs an admin login).
- **Follow-up (invite failed with "Failed to send a request to the Edge Function")**: that is supabase-js's `FunctionsFetchError` = the browser got no usable reply (most often the function is not deployed to the linked project; or a CORS preflight refusal). `supabase/functions/invite-employee/index.ts` now echoes the headers the preflight asks for (default list adds `x-retry-count`) instead of a fixed list; `lib/invite-error.ts` maps `FunctionsFetchError` to `employees.add.inviteUnreachable` ("check that invite-employee is deployed…") with a unit test; `supabase/HOSTED-SETUP.md` has an "If an invite fails" checklist. NOT verified: the cause on the user's project (needs `supabase functions list` / the function logs); redeploy the function after extracting.

### Round 44: Cleanup — CURRENT
- Audit method: knip (unused files/exports/dependencies), a script comparing every English text key to its uses (literal `"area.key"` or a dynamic `` `prefix.${x}` `` pattern), grep for stale names (Filipino, language store, removed components), build-cache and leftover checks. Knip false positives kept on purpose: `apps/web/public/sw.js` (registered at runtime), `packages/config/tailwind.preset.js` (loaded by `tailwind.config.cjs`; also where `tailwindcss-animate` is required, so that dependency stays), `supabase/functions/invite-employee/index.ts` (Deno function, deployed with the CLI).
- Removed: `apps/web/src/hooks/use-has-role.ts` (replaced by `usePermission` in Round 17) and `cleanup-round39.ps1` (already run) via `cleanup-round44.ps1` (preview by default, `-Delete` to remove); the unused `openPage` helper in `e2e/fixtures.ts`; unused dependencies `@tanstack/react-table` (apps/web) and `drizzle-orm` from `packages/modules/{expenses,inventory,scheduling}` (catalog/pos/booking still use it); `pnpm-lock.yaml` regenerated (run `pnpm install` after extracting); 33 text keys nothing referenced (19 in `common.*`, 3 `errors.*`, 7 `details.fields.*`, 3 `cashClose.*`, `customers.exportHint`); `*.tsbuildinfo` added to `.gitignore` (if `apps/web/tsconfig.tsbuildinfo` is already tracked in git, run `git rm --cached apps/web/tsconfig.tsbuildinfo`).
- Left as is, on purpose: ~20 exports only used inside their own file (e.g. `sumWindow`, `SCAN_GAP_MS`) and 9 exported types nobody imports (harmless, tests/readability); 25 `any` casts that map raw Supabase rows in `lib/repositories/supabase-*repository.ts` and `packages/modules/*/src/supabase-repository.ts` (replacing them needs generated database types, a separate piece of work); two `eslint-disable react-hooks/exhaustive-deps` lines that carry a reason; `e2e/language-and-theme.spec.ts` keeps its old name.
- Verified in the sandbox: `pnpm install --frozen-lockfile` OK, tsc clean, eslint clean (web + root lint), root typecheck, unit 156 + module packages pass, Playwright 87 passed + 2 skipped (live specs), production build OK. NOT verified: the cleanup script run on the user's machine (preview/delete), `pnpm install` on the user's machine with the new lockfile.

