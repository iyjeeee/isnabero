import type { ModuleKey } from "@/lib/module-registry";

export interface PaymentRecordView {
  id: string;
  sourceModule: string;
  method: string;
  referenceCode: string | null;
  amount: number;
  createdAt: Date;
  voidedAt: Date | null;
  // what the payment was for — filled from the POS order or booking behind it (all null when neither exists)
  summary: string | null; // e.g. "2 × Sisig, Iced tea" or "Photo booth package"
  receiptNumber: number | null; // POS sales only
  cashierName: string | null; // POS sales only
  customerName: string | null; // bookings only
}

export interface EmployeeView {
  id: string;
  fullName: string;
  role: string;
  createdAt: Date;
}

// Membership: which business a signed-in user belongs to, and their employee row there
export interface Membership {
  business: { id: string; name: string };
  employee: EmployeeView;
}

export interface DashboardStats {
  todaySalesTotal: number;
  upcomingBookingsCount: number;
  activeEmployeesCount: number;
}

export interface BusinessView {
  id: string;
  name: string;
  slug: string;
  setupCompletedAt: Date | null; // null = first-run setup wizard not finished yet
  address: string | null; // receipt details (see ReceiptDetails)
  tin: string | null;
  contactNumber: string | null;
  receiptFooter: string | null;
}

// ReceiptDetails: the business info printed on sales receipts. Every field is optional; empty means "don't print".
export interface ReceiptDetails {
  address: string | null;
  tin: string | null;
  contactNumber: string | null;
  receiptFooter: string | null;
}

export type ReceiptDetailsInput = { [K in keyof ReceiptDetails]: string };
export type ReceiptDetailsErrors = Partial<Record<keyof ReceiptDetails, string>>;

export const RECEIPT_ADDRESS_MAX = 200;
export const RECEIPT_CONTACT_MAX = 30;
export const RECEIPT_FOOTER_MAX = 120;

// formatTin: 9 or 12 digits -> 123-456-789 / 123-456-789-000; null if it isn't a plausible TIN
export function formatTin(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits) || (digits.length !== 9 && digits.length !== 12)) return null;
  return digits.match(/\d{3}/g)?.join("-") ?? null;
}

// validateReceiptDetails: shared by both repositories and the form. Trims, turns blanks into null, formats the TIN.
export function validateReceiptDetails(input: ReceiptDetailsInput): { values: ReceiptDetails; errors: ReceiptDetailsErrors } {
  const errors: ReceiptDetailsErrors = {};
  const clean = (value: string) => value.trim() || null;
  const address = clean(input.address);
  const contactNumber = clean(input.contactNumber);
  const receiptFooter = clean(input.receiptFooter);
  const rawTin = clean(input.tin);
  let tin: string | null = null;

  if (address && address.length > RECEIPT_ADDRESS_MAX) errors.address = `Address must be ${RECEIPT_ADDRESS_MAX} characters or fewer.`;
  if (contactNumber && contactNumber.length > RECEIPT_CONTACT_MAX) errors.contactNumber = `Contact number must be ${RECEIPT_CONTACT_MAX} characters or fewer.`;
  else if (contactNumber && !/^[\d\s+()-]+$/.test(contactNumber)) errors.contactNumber = "Use digits, spaces, +, - and brackets only.";
  if (receiptFooter && receiptFooter.length > RECEIPT_FOOTER_MAX) errors.receiptFooter = `Footer must be ${RECEIPT_FOOTER_MAX} characters or fewer.`;
  if (rawTin) {
    tin = formatTin(rawTin);
    if (!tin) errors.tin = "A TIN has 9 digits (or 12 with the branch code), e.g. 123-456-789-000.";
  }
  return { values: { address, tin, contactNumber, receiptFooter }, errors };
}

// normalizeReceiptDetails: throws the first problem (surfaced by the global mutation error toast)
export function normalizeReceiptDetails(input: ReceiptDetailsInput): ReceiptDetails {
  const { values, errors } = validateReceiptDetails(input);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);
  return values;
}

export interface SaveBusinessSetupInput {
  name: string;
  enabledModules: ModuleKey[]; // desired on-set among registered modules; required modules are added automatically
}

export interface CreateEmployeeInput {
  fullName: string;
  role: "owner" | "admin" | "staff";
}

export type UpdateEmployeeInput = CreateEmployeeInput;

// LAST_OWNER_MESSAGE: shared by mock + Supabase repositories (surfaced via the global mutation error toast)
export const LAST_OWNER_MESSAGE = "A business must keep at least one owner. Make someone else an owner first.";

export const BUSINESS_NAME_MAX = 80;

// normalizeBusinessName: shared by mock + Supabase repositories — trims and rejects empty / too-long names
export function normalizeBusinessName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Business name is required.");
  if (trimmed.length > BUSINESS_NAME_MAX) throw new Error(`Business name must be ${BUSINESS_NAME_MAX} characters or fewer.`);
  return trimmed;
}

// AuditLogEntry: one line of the append-only audit_log (written by DB triggers in Supabase mode, recordAudit in mock mode)
export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string; // see AUDIT_ACTIONS in @isnabero/db
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: Date;
}

export interface ListAuditLogOptions {
  limit?: number; // newest first; default 500
}

export interface ListPaymentRecordsOptions {
  includeVoided?: boolean;
}

// CoreRepository: data-access contract for everything that's always-on (not a toggleable module).
export interface CoreRepository {
  getBusiness(businessId: string): Promise<BusinessView>;
  // saveBusinessSetup: setup wizard save — renames the business, sets every registered module on/off, and stamps
  // setupCompletedAt the first time only (re-running the wizard later keeps the original date).
  saveBusinessSetup(businessId: string, input: SaveBusinessSetupInput): Promise<BusinessView>;
  // saveReceiptDetails: owner/admin (business.configure); updates only the receipt fields, not the name or modules
  saveReceiptDetails(businessId: string, input: ReceiptDetailsInput): Promise<BusinessView>;
  listEnabledModules(businessId: string): Promise<ModuleKey[]>;
  listPaymentRecords(businessId: string, options?: ListPaymentRecordsOptions): Promise<PaymentRecordView[]>;
  // voidPaymentRecord: intentionally NO delete/update — a payment record is financial history and a
  // snapshot of a POS order/booking total (editing its amount post-hoc would desync it from the source).
  // "Removing" a mistaken/duplicate entry marks it voided (excluded from totals/default view) instead
  // of erasing it, so there's always an audit trail of what happened.
  voidPaymentRecord(businessId: string, recordId: string): Promise<void>;
  listEmployees(businessId: string): Promise<EmployeeView[]>;
  createEmployee(businessId: string, input: CreateEmployeeInput): Promise<EmployeeView>;
  // update/deleteEmployee reject (throw) if they would leave the business with no owner — see LAST_OWNER_MESSAGE.
  updateEmployee(businessId: string, employeeId: string, input: UpdateEmployeeInput): Promise<EmployeeView>;
  deleteEmployee(businessId: string, employeeId: string): Promise<void>;
  // getCurrentEmployee: resolves the employee row for a given auth user within a business — the
  // foundation for role checks (see usePermission). Returns null if the user has no employee record for
  // this business (shouldn't normally happen once the invite flow is fully wired up).
  getCurrentEmployee(businessId: string, userId: string): Promise<EmployeeView | null>;
  // getMembership: the business a user belongs to (their oldest employee row), or null when they belong to none.
  // Used after login to pick the business instead of assuming one; multi-business switching isn't built yet.
  getMembership(userId: string): Promise<Membership | null>;
  getDashboardStats(businessId: string): Promise<DashboardStats>;
  // listAuditLog: read-only by design — the log is written by triggers / recordAudit, never by the app UI.
  listAuditLog(businessId: string, options?: ListAuditLogOptions): Promise<AuditLogEntry[]>;
}

// summarizeLines: "2 × Sisig, Iced tea" — a short, human line for what a sale contained (a quantity of 1 is left implicit)
export function summarizeLines(lines: { name: string; quantity: number }[]): string | null {
  if (lines.length === 0) return null;
  return lines.map((line) => (line.quantity > 1 ? `${line.quantity} × ${line.name}` : line.name)).join(", ");
}
