import type { ModuleKey } from "@/lib/module-registry";

export interface PaymentRecordView {
  id: string;
  sourceModule: string;
  method: string;
  referenceCode: string | null;
  amount: number;
  createdAt: Date;
  voidedAt: Date | null;
}

export interface EmployeeView {
  id: string;
  fullName: string;
  role: string;
  createdAt: Date;
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
  getDashboardStats(businessId: string): Promise<DashboardStats>;
  // listAuditLog: read-only by design — the log is written by triggers / recordAudit, never by the app UI.
  listAuditLog(businessId: string, options?: ListAuditLogOptions): Promise<AuditLogEntry[]>;
}
