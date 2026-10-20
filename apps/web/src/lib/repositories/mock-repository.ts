import { mockDb, delay, genId, recordAudit, auditRows, auditPeso, voidMockSale, cashCloseRows, getAuditActor, DEMO_OWNER_USER_ID, type CashCloseRow } from "@isnabero/db";
import { LAST_OWNER_MESSAGE, expectedCash, normalizeBusinessName, normalizeReceiptDetails, summarizeLines, validateCashAmounts } from "./repository";
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
  Membership,
  CashCloseSummary,
  CashCloseView,
  CloseCashInput,
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

function toCashCloseView(row: CashCloseRow): CashCloseView {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    openingFloat: Number(row.openingFloat),
    cashSales: Number(row.cashSales),
    cashExpenses: Number(row.cashExpenses),
    expected: Number(row.expected),
    counted: Number(row.counted),
    difference: Number(row.difference),
    note: row.note,
    closedByName: row.closedByName,
    createdAt: row.createdAt,
  };
}

// lastCloseOf: the most recent close for a business (the next period starts where it ended)
function lastCloseOf(businessId: string): CashCloseRow | undefined {
  return cashCloseRows.filter((row) => row.businessId === businessId).sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime())[0];
}

// cashSince: cash taken in and paid out between two moments (voided records left out) — same rule as cash_totals() in migration 0015
function cashBetween(businessId: string, start: Date, end: Date) {
  const inRange = (date: Date) => date >= start && date < end;
  const sum = (amounts: string[]) => Math.round(amounts.reduce((total, amount) => total + Number(amount), 0) * 100) / 100;
  return {
    cashSales: sum(mockDb.paymentRecords.filter((row) => row.businessId === businessId && row.method === "cash" && !row.voidedAt && inRange(row.createdAt)).map((row) => row.amount)),
    cashExpenses: sum(mockDb.expenses.filter((row) => row.businessId === businessId && row.method === "cash" && !row.voidedAt && inRange(row.createdAt)).map((row) => row.amount)),
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
      .map((record) => {
        const order = mockDb.posOrders.find((item) => item.paymentRecordId === record.id);
        const booking = mockDb.bookings.find((item) => item.paymentRecordId === record.id);
        const offeringName = (id: string) => mockDb.offerings.find((item) => item.id === id)?.name ?? "Item";
        const lines = order ? mockDb.posOrderItems.filter((item) => item.orderId === order.id) : [];
        return {
          id: record.id,
          sourceModule: record.sourceModule,
          method: record.method,
          referenceCode: record.referenceCode,
          amount: Number(record.amount),
          createdAt: record.createdAt,
          voidedAt: record.voidedAt,
          summary: order ? summarizeLines(lines.map((line) => ({ name: offeringName(line.offeringId), quantity: line.quantity }))) : booking ? offeringName(booking.offeringId) : null,
          receiptNumber: order?.receiptNumber ?? null,
          cashierName: (order?.employeeId && mockDb.employees.find((item) => item.id === order.employeeId)?.fullName) || null,
          customerName: booking?.customerName ?? null,
        };
      });
  },

  async voidPaymentRecord(businessId, recordId): Promise<void> {
    await delay(250);
    const record = mockDb.paymentRecords.find((item) => item.id === recordId && item.businessId === businessId);
    if (record && !record.voidedAt) {
      record.voidedAt = new Date();
      recordAudit({ businessId, action: "payment.voided", entityId: record.id, summary: `Voided ${auditPeso(record.amount)} ${record.sourceModule} payment (${record.method})` });
      if (record.sourceModule === "pos") voidMockSale(record.id); // the sale is cancelled: its items go back on the shelf
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
    // Their shifts go with them, silently (the database cascades the same way)
    for (let i = mockDb.shifts.length - 1; i >= 0; i--) if (mockDb.shifts[i]?.employeeId === employeeId) mockDb.shifts.splice(i, 1);
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

  async getMembership(userId): Promise<Membership | null> {
    await delay(100);
    const employee = mockDb.employees.find((item) => item.userId === userId || userId === DEMO_OWNER_USER_ID);
    const business = employee && mockDb.businesses.find((item) => item.id === employee.businessId);
    if (!employee || !business) return null;
    return { business: { id: business.id, name: business.name }, employee: { id: employee.id, fullName: employee.fullName, role: employee.role, createdAt: employee.createdAt } };
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
    const dayBefore = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
    const yesterdaySalesTotal = mockDb.paymentRecords
      .filter((record) => record.businessId === businessId && record.createdAt >= dayBefore(startOfDay) && record.createdAt < dayBefore(now) && !record.voidedAt)
      .reduce((sum, record) => sum + Number(record.amount), 0);

    const upcomingBookingsCount = mockDb.bookings.filter(
      (booking) =>
        booking.businessId === businessId &&
        booking.startTime >= now &&
        (booking.status === "pending" || booking.status === "confirmed"),
    ).length;

    const activeEmployeesCount = mockDb.employees.filter((employee) => employee.businessId === businessId).length;

    return { todaySalesTotal, yesterdaySalesTotal, upcomingBookingsCount, activeEmployeesCount };
  },

  async getCashCloseSummary(businessId, dayStart): Promise<CashCloseSummary> {
    await delay(100);
    const last = lastCloseOf(businessId);
    const now = new Date();
    const periodStart = last?.periodEnd ?? new Date(Math.min(dayStart.getTime(), now.getTime()));
    return { periodStart, ...cashBetween(businessId, periodStart, now), lastCounted: last ? Number(last.counted) : null };
  },

  async closeCash(businessId, dayStart, input: CloseCashInput): Promise<CashCloseView> {
    await delay(300);
    validateCashAmounts(input.openingFloat, input.counted);
    const now = new Date();
    const periodStart = lastCloseOf(businessId)?.periodEnd ?? new Date(Math.min(dayStart.getTime(), now.getTime()));
    const { cashSales, cashExpenses } = cashBetween(businessId, periodStart, now);
    const expected = expectedCash(input.openingFloat, cashSales, cashExpenses);
    const counted = Math.round(input.counted * 100) / 100;
    const actor = getAuditActor();
    const row: CashCloseRow = {
      id: genId(),
      businessId,
      periodStart,
      periodEnd: now,
      openingFloat: input.openingFloat.toFixed(2),
      cashSales: cashSales.toFixed(2),
      cashExpenses: cashExpenses.toFixed(2),
      expected: expected.toFixed(2),
      counted: counted.toFixed(2),
      difference: (counted - expected).toFixed(2),
      note: input.note?.trim() || null,
      closedBy: actor?.id ?? null,
      closedByName: actor?.name ?? "System",
      createdAt: now,
    };
    cashCloseRows.push(row);
    const difference = counted - expected;
    const verdict = Math.abs(difference) < 0.005 ? "balanced" : difference < 0 ? `short ${auditPeso(-difference)}` : `over ${auditPeso(difference)}`;
    recordAudit({ businessId, action: "cash.closed", entityId: row.id, summary: `Cash closed: counted ${auditPeso(counted)} vs expected ${auditPeso(expected)} (${verdict})` });
    return toCashCloseView(row);
  },

  async listCashCloses(businessId): Promise<CashCloseView[]> {
    await delay(100);
    return cashCloseRows.filter((row) => row.businessId === businessId).sort((a, b) => b.periodEnd.getTime() - a.periodEnd.getTime()).map(toCashCloseView);
  },
};
