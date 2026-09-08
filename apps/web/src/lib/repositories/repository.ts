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

export interface CreateEmployeeInput {
  fullName: string;
  role: "owner" | "admin" | "staff";
}

export type UpdateEmployeeInput = CreateEmployeeInput;

export interface ListPaymentRecordsOptions {
  includeVoided?: boolean;
}

// CoreRepository: data-access contract for everything that's always-on (not a toggleable module).
export interface CoreRepository {
  listEnabledModules(businessId: string): Promise<ModuleKey[]>;
  listPaymentRecords(businessId: string, options?: ListPaymentRecordsOptions): Promise<PaymentRecordView[]>;
  // voidPaymentRecord: intentionally NO delete/update — a payment record is financial history and a
  // snapshot of a POS order/booking total (editing its amount post-hoc would desync it from the source).
  // "Removing" a mistaken/duplicate entry marks it voided (excluded from totals/default view) instead
  // of erasing it, so there's always an audit trail of what happened.
  voidPaymentRecord(businessId: string, recordId: string): Promise<void>;
  listEmployees(businessId: string): Promise<EmployeeView[]>;
  createEmployee(businessId: string, input: CreateEmployeeInput): Promise<EmployeeView>;
  updateEmployee(businessId: string, employeeId: string, input: UpdateEmployeeInput): Promise<EmployeeView>;
  deleteEmployee(businessId: string, employeeId: string): Promise<void>;
  // getCurrentEmployee: resolves the employee row for a given auth user within a business — the
  // foundation for role checks (see useHasRole). Returns null if the user has no employee record for
  // this business (shouldn't normally happen once the invite flow is fully wired up).
  getCurrentEmployee(businessId: string, userId: string): Promise<EmployeeView | null>;
  getDashboardStats(businessId: string): Promise<DashboardStats>;
}
