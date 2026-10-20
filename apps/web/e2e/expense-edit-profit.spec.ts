import { test, expect, goTo, rowFor } from "./fixtures";

test.describe("editing an expense and the profit report", () => {
  test("an edit changes the list, is audited, and moves the profit figure", async ({ page }) => {
    await page.goto("/app/reports");
    const profit = page.getByTestId("profit-total");
    await expect(profit).toBeVisible();
    const before = (await profit.innerText()).replace("−", "-").replace(/[^\d.-]/g, "");

    await goTo(page, "Expenses");
    await page.getByRole("button", { name: "Add expense" }).click();
    const form = page.getByRole("dialog", { name: "Add expense" });
    await form.getByLabel("Description").fill("E2E edit me");
    await form.getByLabel("Amount (₱)").fill("100");
    await form.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Expense recorded")).toBeVisible();

    await rowFor(page, "E2E edit me").getByRole("button", { name: /Edit expense/ }).click();
    const edit = page.getByRole("dialog", { name: "Edit expense" });
    await expect(edit.getByLabel("Amount (₱)")).toHaveValue("100");
    await edit.getByLabel("Amount (₱)").fill("175.25");
    await edit.getByRole("button", { name: "Save expense" }).click();
    await expect(page.getByText("Expense updated")).toBeVisible();
    await expect(rowFor(page, "E2E edit me")).toContainText("₱175.25");

    await goTo(page, "Audit Log");
    await expect(rowFor(page, /Edited expense "E2E edit me": amount ₱100.00 → ₱175.25/).first()).toBeVisible();

    // profit dropped by exactly the new amount
    await goTo(page, "Reports");
    await expect
      .poll(async () => {
        const after = (await page.getByTestId("profit-total").innerText()).replace("−", "-").replace(/[^\d.-]/g, "");
        return Math.round((Number(before) - Number(after)) * 100) / 100;
      })
      .toBe(175.25);
  });
});
