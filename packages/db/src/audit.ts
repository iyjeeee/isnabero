// AUDIT_ACTIONS: the closed list of audited events. The `action` strings are stored in audit_log.action, so the
// Supabase triggers (migration 0005) and the mock repositories must use exactly these values.
export const AUDIT_ACTIONS = {
  "sale.completed": { entity: "sale", label: "Sale completed" },
  "payment.voided": { entity: "payment", label: "Payment voided" },
  "booking.created": { entity: "booking", label: "Booking created" },
  "offering.created": { entity: "offering", label: "Offering added" },
  "offering.availability_changed": { entity: "offering", label: "Availability changed" },
  "expense.created": { entity: "expense", label: "Expense recorded" },
  "expense.voided": { entity: "expense", label: "Expense voided" },
  "employee.created": { entity: "employee", label: "Employee added" },
  "employee.updated": { entity: "employee", label: "Employee updated" },
  "employee.deleted": { entity: "employee", label: "Employee removed" },
  "stock.tracking_changed": { entity: "stock", label: "Stock tracking changed" },
  "stock.adjusted": { entity: "stock", label: "Stock adjusted" },
  "shift.created": { entity: "shift", label: "Shift scheduled" },
  "shift.updated": { entity: "shift", label: "Shift changed" },
  "shift.deleted": { entity: "shift", label: "Shift removed" },
  "business.updated": { entity: "business", label: "Business updated" },
  "business.modules_changed": { entity: "business", label: "Modules changed" },
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;
export type AuditEntity = (typeof AUDIT_ACTIONS)[AuditAction]["entity"];

// auditPeso: money as written in audit summaries (the Supabase triggers format it the same way: ₱1234.50)
export function auditPeso(amount: number | string): string {
  return `₱${Number(amount).toFixed(2)}`;
}

export function getAuditActionLabel(action: string): string {
  return (AUDIT_ACTIONS as Record<string, { label: string }>)[action]?.label ?? action;
}
