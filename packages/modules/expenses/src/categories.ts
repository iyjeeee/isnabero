// EXPENSE_CATEGORIES: fixed list for v1 — keep in sync with expenseCategoryEnum in packages/db (a test checks this)
export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Supplies" },
  { value: "salaries", label: "Salaries" },
  { value: "other", label: "Other" },
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"];

// EXPENSE_CATEGORY_VALUES: tuple form for z.enum(...)
export const EXPENSE_CATEGORY_VALUES = EXPENSE_CATEGORIES.map((category) => category.value) as [ExpenseCategory, ...ExpenseCategory[]];

export function getExpenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
