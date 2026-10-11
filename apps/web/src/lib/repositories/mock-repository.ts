import { mockDb, delay, genId, recordAudit, auditRows, auditPeso, DEMO_OWNER_USER_ID } from "@isnabero/db";
import { LAST_OWNER_MESSAGE, normalizeBusinessName, normalizeReceiptDetails } from "./repository";
import type {
  BusinessView,
  SaveBusinessSetupInput,
  ReceiptDetailsInput,
  CoreRepository,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  DashboardStats,
  EmployeeView,
  PaymentRecordView,
  ListPaymentRecordsOptions,
  AuditLogEntry,
  ListAuditLogOptions,
} from "./repository";
import { MODULE_REGISTRY, normalizeModules, type ModuleKey } from "@/lib/module-registry";

// isLastOwner: true if this employee is the only owner left in their business
function isLastOwner(businessId: string, employeeId: string): boolean {
  const owners = mockDb.employees.filter((item) => item.businessId === businessId && item.role === "owner");
  return owners.length === 1 && owners[0]?.id === employeeId;
}

function findBusiness(businessId: string) {
  const business = mockDb.businesses.find((item) => item.id === businessId);
  if (!business) throw new Error("Business not found");
  return business;
}

function toBusinessView(business: (typeof mockDb.businesses)[number]): BusinessView {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    setupCompletedAt: business.setupCompletedAt,
    address: business.address,
    tin: business.tin,
    contactNumber: business.contactNumber,
    receiptFooter: business.receiptFooter,
  };
}

export const mockCoreRepository: CoreRepository = {
  async getBusiness(businessId): Promise<BusinessView> {
    await delay(100);
    return toBusinessView(findBusiness(businessId));
  },

  async saveBusinessSetup(businessId, input: SaveBusinessSetupInput): Promise<BusinessView> {
    await delay(300);
    const business = findBusiness(businessId);
    const name = normalizeBusinessName(input.name);
    const enabled = new Set(normalizeModules(input.enabledModules));
    const before = new Set(mockDb.businessModules.filter((row) => row.businessId === businessId && row.enabled).map((row) => row.moduleKey));
    const previousName = business.name;
    const firstSetup = business.setupCompletedAt === null;
    for (const definition of MODULE_REGISTRY) {
      const row = mockDb.businessModules.find((item) => item.businessId === businessId && item.moduleKey === definition.key);
      if (row) row.enabled = enabled.has(definition.key);
      else mockDb.businessModules.push({ id: genId(), businessId, moduleKey: definition.key, enabled: enabled.has(definition.key), createdAt: new Date() });
    }
    business.name = name;
    business.setupCompletedAt ??= new Date();
    if (name !== previousName || firstSetup) {
      recordAudit({ businessId, action: "business.updated", entityId: businessId, summary: name !== previousName ? `Business renamed from "${previousName}" to "${name}"` : "Business setup completed" });
    }
    // One entry per module that flipped (module key, like the Supabase trigger writes it)
    for (const definition of MODULE_REGISTRY) {
      if (enabled.has(definition.key) === before.has(definition.key)) continue;
      recordAudit({ businessId, action: "business.modules_changed", entityId: businessId, summary: `Module ${definition.key} turned ${enabled.has(definition.key) ? "on" : "off"}` });
    }
    return toBusinessView(business);
  },

  async saveReceiptDetails(businessId, input: ReceiptDetailsInput): Promise<BusinessView> {
    await delay(250);
    const business = findBusiness(businessId);
    const next = normalizeReceiptDetails(input);
    const changed = next.address !== business.address || next.tin !== business.tin || next.contactNumber !== business.contactNumber || next.receiptFooter !== business.receiptFooter;
    Object.assign(business, { address: next.address, tin: next.tin, contactNumber: next.contactNumber, receiptFooter: next.receiptFooter });
    if (changed) recordAudit({ businessId, action: "business.updated", entityId: businessId, summary: "Receipt details updated" });
    return toBusinessView(business);
  },

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
    if (record && !record.voidedAt) {
      record.voidedAt = new Date();
      recordAudit({ businessId, action: "payment.voided", entityId: record.id, summary: `Voided ${auditPeso(record.amount)} ${record.sourceModule} payment (${record.method})` });
    }
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
    recordAudit({ businessId, action: "employee.created", entityId: employee.id, summary: `Added ${employee.fullName} as ${employee.role}` });
    return { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt };
  },

  async updateEmployee(businessId, employeeId, input: UpdateEmployeeInput): Promise<EmployeeView> {
    await delay(300);
    const employee = mockDb.employees.find((item) => item.id === employeeId && item.businessId === businessId);
    if (!employee) throw new Error("Employee not found");
    if (input.role !== "owner" && isLastOwner(businessId, employeeId)) throw new Error(LAST_OWNER_MESSAGE);
    const previous = { fullName: employee.fullName, role: employee.role };
    employee.fullName = input.fullName;
    employee.role = input.role;
    const changes = [previous.fullName !== employee.fullName ? `renamed from "${previous.fullName}"` : "", previous.role !== employee.role ? `role ${previous.role} → ${employee.role}` : ""].filter(Boolean);
    if (changes.length > 0) recordAudit({ businessId, action: "employee.updated", entityId: employee.id, summary: `Updated ${employee.fullName}: ${changes.join(", ")}` });
    return { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt };
  },

  async deleteEmployee(businessId, employeeId): Promise<void> {
    await delay(250);
    const index = mockDb.employees.findIndex((employee) => employee.id === employeeId && employee.businessId === businessId);
    if (index === -1) return;
    if (isLastOwner(businessId, employeeId)) throw new Error(LAST_OWNER_MESSAGE);
    const [removed] = mockDb.employees.splice(index, 1);
    if (removed) recordAudit({ businessId, action: "employee.deleted", entityId: removed.id, summary: `Removed ${removed.fullName} (${removed.role})` });
  },

  async listAuditLog(businessId, options?: ListAuditLogOptions): Promise<AuditLogEntry[]> {
    await delay();
    return auditRows
      .filter((row) => row.businessId === businessId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, options?.limit ?? 500)
      .map((row) => ({ ...row }));
  },

  async getCurrentEmployee(businessId, userId): Promise<EmployeeView | null> {
    await delay(100);
    // Mock sessions act as a seeded employee (see AuthProvider's VITE_MOCK_ROLE) — match on userId; the owner id
    // also resolves to the first employee so the default session keeps working if seed ordering changes.
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
