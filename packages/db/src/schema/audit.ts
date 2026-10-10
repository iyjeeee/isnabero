import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { businesses, employees } from "./core";

// audit_log: append-only history of who changed what. Written by database triggers in Supabase mode (see migration 0005)
// and by recordAudit() in mock mode. No update/delete policy exists, so rows are permanent.
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => employees.id, { onDelete: "set null" }), // null = system / deleted employee
  actorName: text("actor_name").notNull().default("System"), // snapshot, so history still reads right after a rename or removal
  action: text("action").notNull(), // one of AUDIT_ACTIONS, e.g. "expense.voided"
  entityType: text("entity_type").notNull(), // the AUDIT_ACTIONS entry's entity, e.g. "expense"
  entityId: uuid("entity_id"), // no FK on purpose: the row may be deleted later (employees) and the log must survive
  summary: text("summary").notNull(), // human-readable one-liner shown in the Audit Log page
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
