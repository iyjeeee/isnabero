import type { InferSelectModel } from "drizzle-orm";
import type {
  businesses,
  businessModules,
  employees,
  paymentRecords,
  offerings,
  offeringInclusions,
  posOrders,
  posOrderItems,
  bookings,
} from "../schema";

// DEMO_BUSINESS_ID matches supabase/seed.sql exactly, so switching VITE_DATA_SOURCE between
// "mock" and "supabase" points at the same tenant id and nothing else in the app needs to change.
export const DEMO_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
// DEMO_OWNER_USER_ID: stable (not random) so AuthProvider's mock-mode session can reference the same
// "logged in as" identity across reloads — matches the seeded owner employee's userId below.
export const DEMO_OWNER_USER_ID = "00000000-0000-0000-0000-00000000000e";

type Business = InferSelectModel<typeof businesses>;
type BusinessModule = InferSelectModel<typeof businessModules>;
type Employee = InferSelectModel<typeof employees>;
type PaymentRecord = InferSelectModel<typeof paymentRecords>;
type Offering = InferSelectModel<typeof offerings>;
type OfferingInclusion = InferSelectModel<typeof offeringInclusions>;
type PosOrder = InferSelectModel<typeof posOrders>;
type PosOrderItem = InferSelectModel<typeof posOrderItems>;
type Booking = InferSelectModel<typeof bookings>;

// genId: lightweight id generator — crypto.randomUUID is available in both browser and Node 20+
function genId(): string {
  return crypto.randomUUID();
}

// delay: simulates network latency so loading states actually get exercised during frontend polish
export function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// mulberry32: tiny deterministic PRNG (fixed seed) — demo data varies day to day and offering to
// offering, but is reproducible across reloads/reports instead of using Math.random(), which would make
// screenshots/reports look different every time the app restarts.
function mulberry32(seed: number) {
  return function random() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}
const intBetween = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min;

// --- Core rows -------------------------------------------------------------------------------

const businessesSeed: Business[] = [
  { id: DEMO_BUSINESS_ID, name: "Sample Business", slug: "sample-business", createdAt: new Date() },
];

const businessModulesSeed: BusinessModule[] = [
  { id: genId(), businessId: DEMO_BUSINESS_ID, moduleKey: "catalog", enabled: true, createdAt: new Date() },
  { id: genId(), businessId: DEMO_BUSINESS_ID, moduleKey: "pos", enabled: true, createdAt: new Date() },
  { id: genId(), businessId: DEMO_BUSINESS_ID, moduleKey: "booking", enabled: true, createdAt: new Date() },
];

// Four employees across all three roles, so role-based UI (badges, gated actions) has real variety
// to render instead of a single owner row.
const employeesSeed: Employee[] = [
  { id: genId(), businessId: DEMO_BUSINESS_ID, userId: DEMO_OWNER_USER_ID, fullName: "Juan Dela Cruz", role: "owner", createdAt: new Date("2026-01-15") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, userId: genId(), fullName: "Maria Santos", role: "admin", createdAt: new Date("2026-02-03") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, userId: genId(), fullName: "Pedro Reyes", role: "staff", createdAt: new Date("2026-03-10") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, userId: genId(), fullName: "Ana Lopez", role: "staff", createdAt: new Date("2026-04-22") },
];

// Seven offerings spanning all three types (item/bundle/addon), one intentionally sold out, so
// Catalog/POS/Reports all have realistic variety instead of two lonely rows.
const offeringsSeed: Offering[] = [
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Sisig", description: "Sizzling pork sisig, single serving", type: "item", price: "150.00", durationMinutes: null, isAvailable: true, createdAt: new Date("2026-01-16") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Lumpia (6 pcs)", description: "Crispy fried spring rolls", type: "item", price: "80.00", durationMinutes: null, isAvailable: true, createdAt: new Date("2026-01-16") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Halo-Halo", description: "Shaved ice dessert with mixed toppings", type: "item", price: "120.00", durationMinutes: null, isAvailable: true, createdAt: new Date("2026-01-20") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Iced Tea", description: "House-brewed iced tea, 16oz", type: "item", price: "40.00", durationMinutes: null, isAvailable: false, createdAt: new Date("2026-01-20") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Bundle A", description: "10 mins unli shots + 2 prints", type: "bundle", price: "499.00", durationMinutes: 10, isAvailable: true, createdAt: new Date("2026-01-16") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Bundle B", description: "20 mins unli shots + 4 prints + 1 photo strip", type: "bundle", price: "799.00", durationMinutes: 20, isAvailable: true, createdAt: new Date("2026-02-01") },
  { id: genId(), businessId: DEMO_BUSINESS_ID, name: "Extra 5 Prints", description: "Add-on for any photobooth package", type: "addon", price: "100.00", durationMinutes: null, isAvailable: true, createdAt: new Date("2026-02-01") },
];

const offeringInclusionsSeed: OfferingInclusion[] = [];
const bundleA = offeringsSeed.find((offering) => offering.name === "Bundle A")!;
const bundleB = offeringsSeed.find((offering) => offering.name === "Bundle B")!;
offeringInclusionsSeed.push(
  { id: genId(), offeringId: bundleA.id, label: "Unli shots", quantity: null },
  { id: genId(), offeringId: bundleA.id, label: "Printed copies", quantity: 2 },
  { id: genId(), offeringId: bundleB.id, label: "Unli shots", quantity: null },
  { id: genId(), offeringId: bundleB.id, label: "Printed copies", quantity: 4 },
  { id: genId(), offeringId: bundleB.id, label: "Photo strip", quantity: 1 },
);

// --- Historical POS + Booking activity, generated deterministically ---------------------------
// Gives Reports (sales trend, booking trend, top offerings) and Payment Records real multi-day data
// to chart/filter, instead of an empty ledger that only fills up as someone clicks around the demo.

const paymentRecordsSeed: PaymentRecord[] = [];
const posOrdersSeed: PosOrder[] = [];
const posOrderItemsSeed: PosOrderItem[] = [];
const bookingsSeed: Booking[] = [];

const sellableItems = offeringsSeed.filter((offering) => offering.type !== "addon" && offering.isAvailable);
const bookableOfferings = offeringsSeed.filter((offering) => offering.durationMinutes);
const paymentMethods = ["cash", "gcash", "bank_transfer", "other"] as const;
const employeeIds = employeesSeed.map((employee) => employee.id);
const customerNames = ["Liza Cruz", "Mark Villanueva", "Grace Tan", "Noel Ramos", "Cathy Uy", "Rico Manalo", "Bea Fernandez", "Jomar Cruz"];

const today = new Date();
today.setHours(0, 0, 0, 0);

// 21 days of history: today-20 .. today, 0-3 POS sales per day plus occasional bookings
for (let dayOffset = 20; dayOffset >= 0; dayOffset--) {
  const day = new Date(today);
  day.setDate(day.getDate() - dayOffset);

  const salesCount = intBetween(0, 3);
  for (let i = 0; i < salesCount; i++) {
    const hour = intBetween(9, 20);
    const minute = intBetween(0, 59);
    const createdAt = new Date(day);
    createdAt.setHours(hour, minute, 0, 0);

    const lineCount = intBetween(1, 2);
    const lines = Array.from({ length: lineCount }, () => ({ offering: pick(sellableItems), quantity: intBetween(1, 3) }));
    const total = lines.reduce((sum, line) => sum + Number(line.offering.price) * line.quantity, 0);
    const method = pick(paymentMethods);
    const voided = rng() < 0.06; // ~6% of historical sales voided, for realistic void-report data

    const payment: PaymentRecord = {
      id: genId(),
      businessId: DEMO_BUSINESS_ID,
      sourceModule: "pos",
      method,
      referenceCode: method === "cash" ? null : `${method.slice(0, 2).toUpperCase()}${intBetween(100000, 999999)}`,
      amount: total.toFixed(2),
      createdAt,
      voidedAt: voided ? new Date(createdAt.getTime() + 30 * 60000) : null,
    };
    paymentRecordsSeed.push(payment);

    const order: PosOrder = {
      id: genId(),
      businessId: DEMO_BUSINESS_ID,
      employeeId: pick(employeeIds),
      status: voided ? "voided" : "paid",
      total: total.toFixed(2),
      paymentRecordId: payment.id,
      createdAt,
    };
    posOrdersSeed.push(order);

    for (const line of lines) {
      posOrderItemsSeed.push({
        id: genId(),
        orderId: order.id,
        offeringId: line.offering.id,
        quantity: line.quantity,
        unitPrice: line.offering.price,
      });
    }
  }

  // ~40% of days also get a booking (mix of past/completed and future/pending-confirmed)
  if (rng() < 0.4) {
    const offering = pick(bookableOfferings);
    const hour = intBetween(9, 18);
    const startTime = new Date(day);
    startTime.setHours(hour, pick([0, 15, 30, 45]), 0, 0);
    const endTime = new Date(startTime.getTime() + (offering.durationMinutes ?? 30) * 60000);
    const isPast = dayOffset > 0;
    const status = isPast ? pick(["completed", "completed", "completed", "cancelled"] as const) : pick(["pending", "confirmed"] as const);

    bookingsSeed.push({
      id: genId(),
      businessId: DEMO_BUSINESS_ID,
      offeringId: offering.id,
      mode: "appointment",
      customerName: pick(customerNames),
      customerContact: null,
      startTime,
      endTime,
      status,
      paymentRecordId: null,
      createdAt: startTime,
    });
  }
}

// A few extra bookings in the near future (next 5 days) so "Upcoming Bookings" / Dashboard /
// Booking page always have something forward-looking to show regardless of when the demo is run.
for (let daysAhead = 1; daysAhead <= 5; daysAhead++) {
  if (rng() < 0.6) {
    const offering = pick(bookableOfferings);
    const day = new Date(today);
    day.setDate(day.getDate() + daysAhead);
    day.setHours(intBetween(9, 18), pick([0, 15, 30, 45]), 0, 0);
    const endTime = new Date(day.getTime() + (offering.durationMinutes ?? 30) * 60000);

    bookingsSeed.push({
      id: genId(),
      businessId: DEMO_BUSINESS_ID,
      offeringId: offering.id,
      mode: "appointment",
      customerName: pick(customerNames),
      customerContact: null,
      startTime: day,
      endTime,
      status: pick(["pending", "confirmed"] as const),
      paymentRecordId: null,
      createdAt: new Date(),
    });
  }
}

// mockDb: plain mutable in-memory tables. Fine for dev-only mock data — components stay reactive via
// React Query cache invalidation in each repository's mutations, not via any reactivity in this store.
export const mockDb = {
  businesses: businessesSeed,
  businessModules: businessModulesSeed,
  employees: employeesSeed,
  paymentRecords: paymentRecordsSeed,
  offerings: offeringsSeed,
  offeringInclusions: offeringInclusionsSeed,
  posOrders: posOrdersSeed,
  posOrderItems: posOrderItemsSeed,
  bookings: bookingsSeed,
};

export { genId };
