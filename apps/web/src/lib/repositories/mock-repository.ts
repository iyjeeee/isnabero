import { mockDb, delay, genId, DEMO_OWNER_USER_ID } from "@isnabero/db";
import type {
  CoreRepository,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DashboardStats,
  EmployeeView,
  PaymentRecordView,
  ListPaymentRecordsOptions,
} from "./repository";
import type { ModuleKey } from "@/lib/module-registry";

export const mockCoreRepository: CoreRepository = {
  async listEnabledModules(businessId): Promise<ModuleKey[]> {
    await delay(150);
    return mockDb.businessModules
      .filter((row) => row.businessId === businessId && row.enabled)
      .map((row) => row.moduleKey as ModuleKey);
  },

  async listPaymentRecords(businessId, options?: ListPaymentRecordsOptions): Promise<PaymentRecordView[]> {
    await delay();
    return mockDb.paymentRecords
      .filter((record) => record.businessId === businessId)
      .filter((record) => options?.includeVoided || !record.voidedAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((record) => ({
        id: record.id,
        sourceModule: record.sourceModule,
        method: record.method,
        referenceCode: record.referenceCode,
        amount: Number(record.amount),
        createdAt: record.createdAt,
        voidedAt: record.voidedAt,
      }));
  },

  async voidPaymentRecord(businessId, recordId): Promise<void> {
    await delay(250);
    const record = mockDb.paymentRecords.find((item) => item.id === recordId && item.businessId === businessId);
    if (record) record.voidedAt = new Date();
  },

  async listEmployees(businessId): Promise<EmployeeView[]> {
    await delay();
    return mockDb.employees
      .filter((employee) => employee.businessId === businessId)
      .map((employee) => ({
        id: employee.id,
        fullName: employee.fullName,
        role: employee.role,
        createdAt: employee.createdAt,
      }));
  },

  async createEmployee(businessId, input: CreateEmployeeInput): Promise<EmployeeView> {
    await delay(300);
    // userId is a placeholder (genId()) until a real invite/auth flow exists — see repository.ts note.
    const employee = {
      id: genId(),
      businessId,
      userId: genId(),
      fullName: input.fullName,
      role: input.role,
      createdAt: new Date(),
    };
    mockDb.employees.push(employee);
    return { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt };
  },

  async updateEmployee(businessId, employeeId, input: UpdateEmployeeInput): Promise<EmployeeView> {
    await delay(300);
    const employee = mockDb.employees.find((item) => item.id === employeeId && item.businessId === businessId);
    if (!employee) throw new Error("Employee not found");
    employee.fullName = input.fullName;
    employee.role = input.role;
    return { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt };
  },

  async deleteEmployee(businessId, employeeId): Promise<void> {
    await delay(250);
    const index = mockDb.employees.findIndex((employee) => employee.id === employeeId && employee.businessId === businessId);
    if (index !== -1) mockDb.employees.splice(index, 1);
  },

  async getCurrentEmployee(businessId, userId): Promise<EmployeeView | null> {
    await delay(100);
    // In mock mode the "logged in" user is always the seeded owner (DEMO_OWNER_USER_ID) — match on
    // that regardless of the exact userId passed in, so this stays correct even if callers pass a
    // slightly different mock user id in future.
    const employee = mockDb.employees.find(
      (item) => item.businessId === businessId && (item.userId === userId || userId === DEMO_OWNER_USER_ID),
    );
    if (!employee) return null;
    return { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt };
  },

  async getDashboardStats(businessId): Promise<DashboardStats> {
    await delay();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const now = new Date();

    const todaySalesTotal = mockDb.paymentRecords
      .filter((record) => record.businessId === businessId && record.createdAt >= startOfDay && !record.voidedAt)
      .reduce((sum, record) => sum + Number(record.amount), 0);

    const upcomingBookingsCount = mockDb.bookings.filter(
      (booking) =>
        booking.businessId === businessId &&
        booking.startTime >= now &&
        (booking.status === "pending" || booking.status === "confirmed"),
    ).length;

    const activeEmployeesCount = mockDb.employees.filter((employee) => employee.businessId === businessId).length;

    return { todaySalesTotal, upcomingBookingsCount, activeEmployeesCount };
  },
};
