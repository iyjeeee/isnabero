import { describe, it, expect } from "vitest";
import { mockDb, DEMO_BUSINESS_ID, expenseCategoryEnum, auditRows, setAuditActor } from "@isnabero/db";
import { mockExpensesRepository } from "../mock-repository";
import { EXPENSE_CATEGORY_VALUES } from "../categories";
import { todayYmd } from "../validation";
import type { CreateExpenseInput } from "../types";

const OTHER_BUSINESS_ID = "00000000-0000-0000-0000-00000000ffff";

function input(overrides: Partial<CreateExpenseInput> = {}): CreateExpenseInput {
  return {
    category: "supplies",
    description: "  Printer paper  ",
    amount: 250.456,
    expenseDate: todayYmd(),
    method: "cash",
    notes: "  ",
    recordedBy: null,
    ...overrides,
  };
}

describe("mockExpensesRepository", () => {
  it("creates an expense with trimmed text, cents-rounded amount and null for blank notes", async () => {
    const expense = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input());
    expect(expense.description).toBe("Printer paper");
    expect(expense.amount).toBe(250.46);
    expect(expense.notes).toBeNull();
    expect(expense.voidedAt).toBeNull();
  });

  it("lists newest expense date first, then newest created, and excludes voided by default", async () => {
    const older = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "sort-older", expenseDate: "2020-01-01" }));
    const voided = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "sort-voided", expenseDate: "2020-01-02" }));
    await mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, voided.id);

    const active = await mockExpensesRepository.listExpenses(DEMO_BUSINESS_ID);
    expect(active.some((e) => e.id === voided.id)).toBe(false);
    expect(active.some((e) => e.id === older.id)).toBe(true);
    for (let i = 1; i < active.length; i++) expect(active[i - 1]!.expenseDate >= active[i]!.expenseDate).toBe(true);

    const all = await mockExpensesRepository.listExpenses(DEMO_BUSINESS_ID, { includeVoided: true });
    expect(all.find((e) => e.id === voided.id)?.voidedAt).toBeInstanceOf(Date);
  });

  it("scopes every operation to the business", async () => {
    const mine = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "scope-mine" }));
    expect(await mockExpensesRepository.listExpenses(OTHER_BUSINESS_ID, { includeVoided: true })).toEqual([]);
    await expect(mockExpensesRepository.voidExpense(OTHER_BUSINESS_ID, mine.id)).rejects.toThrow("Expense not found");
    expect(mockDb.expenses.find((row) => row.id === mine.id)?.voidedAt).toBeNull();
  });

  it("void is idempotent (keeps the first timestamp) and throws for an unknown id", async () => {
    const expense = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "void-twice" }));
    await mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, expense.id);
    const first = mockDb.expenses.find((row) => row.id === expense.id)!.voidedAt;
    await mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, expense.id);
    expect(mockDb.expenses.find((row) => row.id === expense.id)!.voidedAt).toBe(first);
    await expect(mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, "missing")).rejects.toThrow("Expense not found");
  });

  it.each([
    ["a future date", input({ expenseDate: "2999-01-01" }), /future/],
    ["an impossible date", input({ expenseDate: "2026-02-31" }), /valid date/],
    ["a zero amount", input({ amount: 0 }), /at least/],
    ["a negative amount", input({ amount: -5 }), /at least/],
    ["a NaN amount", input({ amount: Number.NaN }), /valid amount/],
    ["an enormous amount", input({ amount: 1e12 }), /too large/],
    ["a blank description", input({ description: "   " }), /required/],
    ["an overlong description", input({ description: "x".repeat(121) }), /120/],
    ["an unknown category", input({ category: "bogus" as never }), /category/],
    ["an unknown payment method", input({ method: "bogus" as never }), /payment method/],
  ])("rejects %s without saving anything", async (_label, bad, message) => {
    const before = mockDb.expenses.length;
    await expect(mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, bad)).rejects.toThrow(message);
    expect(mockDb.expenses.length).toBe(before);
  });
});

describe("expense categories", () => {
  it("match the database enum exactly (keeps the two lists in sync)", () => {
    expect([...EXPENSE_CATEGORY_VALUES].sort()).toEqual([...expenseCategoryEnum.enumValues].sort());
  });
});

describe("expenses audit trail", () => {
  const auditFor = (id: string) => auditRows.filter((row) => row.entityId === id).map((row) => row.action);

  it("logs who recorded and voided an expense, and voiding twice logs once", async () => {
    setAuditActor({ id: "00000000-0000-0000-0000-000000000110", name: "Maria Santos" });
    try {
      const expense = await mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "Audit paper", amount: 99.5 }));
      await mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, expense.id);
      await mockExpensesRepository.voidExpense(DEMO_BUSINESS_ID, expense.id);
      expect(auditFor(expense.id)).toEqual(["expense.created", "expense.voided"]);
      const created = auditRows.find((row) => row.entityId === expense.id)!;
      expect(created).toMatchObject({ actorName: "Maria Santos", entityType: "expense", summary: 'Recorded expense "Audit paper" ₱99.50 (supplies)' });
    } finally {
      setAuditActor(null);
    }
  });

  it("logs nothing for a rejected expense", async () => {
    const before = auditRows.length;
    await expect(mockExpensesRepository.createExpense(DEMO_BUSINESS_ID, input({ description: "" }))).rejects.toThrow();
    expect(auditRows.length).toBe(before);
  });
});
