import { test, expect, goTo, rowFor } from "./fixtures";

test.describe("expenses and the audit log", () => {
  test("adds an expense, sees it in the list, details and audit log, then voids it", async ({ page }) => {
    await page.goto("/app/expenses");
    await page.getByRole("button", { name: "Add expense" }).click();
    const form = page.getByRole("dialog", { name: "Add expense" });
    await form.getByLabel("Category").selectOption({ label: "Supplies" });
    await form.getByLabel("Description").fill("E2E printer paper");
    await form.getByLabel("Amount (₱)").fill("250.50");
    await form.getByLabel("Notes (optional)").fill("two reams");
    await form.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Expense recorded")).toBeVisible();

    const row = rowFor(page, "E2E printer paper");
    await expect(row).toContainText("₱250.50");
    await expect(row).toContainText("Juan Dela Cruz"); // recorded by

    await row.click();
    const details = page.getByRole("dialog", { name: "E2E printer paper" });
    await expect(details).toContainText("two reams");
    await expect(details).toContainText("Juan Dela Cruz");
    await expect(details).toContainText("Active");
    await page.keyboard.press("Escape");

    // the audit log picked it up, and its entry opens too
    await goTo(page, "Audit Log");
    const entry = rowFor(page, "Expense recorded").first();
    await expect(entry).toContainText("Juan Dela Cruz");
    await entry.click();
    const audit = page.getByRole("dialog", { name: "Expense recorded" });
    await expect(audit).toContainText("What happened");
    await expect(audit).toContainText("E2E printer paper");
    await page.keyboard.press("Escape");

    // void it
    await goTo(page, "Expenses");
    await rowFor(page, "E2E printer paper").getByRole("button", { name: /Void expense/ }).click();
    await page.getByRole("button", { name: "Void expense" }).click();
    await expect(page.getByText("Expense voided")).toBeVisible();
    await expect(rowFor(page, "E2E printer paper")).toHaveCount(0);
    await page.getByLabel("Show voided").check();
    await expect(rowFor(page, "E2E printer paper")).toContainText("Voided");
  });

  test("validates the form", async ({ page }) => {
    await page.goto("/app/expenses");
    await page.getByRole("button", { name: "Add expense" }).click();
    const form = page.getByRole("dialog", { name: "Add expense" });
    await form.getByRole("button", { name: "Save expense" }).click();
    await expect(form.getByText("Description is required")).toBeVisible();
    await expect(form.getByText("Amount is required")).toBeVisible();
    await form.getByLabel("Description").fill("x");
    await form.getByLabel("Amount (₱)").fill("0");
    await form.getByRole("button", { name: "Save expense" }).click();
    await expect(form.getByText("Amount must be at least ₱0.01")).toBeVisible();
  });
});
