import { test, expect, sidebar } from "../fixtures";

// Runs against the staff-session server (VITE_MOCK_ROLE=staff): everything gated to owner/admin must be hidden and blocked.
test.describe("staff role", () => {
  test("sidebar hides expenses, audit log and setup", async ({ page }) => {
    await page.goto("/app");
    const nav = sidebar(page);
    await expect(nav.getByRole("link", { name: "POS / Cashier" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Schedule" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Expenses" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit Log" })).toHaveCount(0);
    await page.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Dark" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Business Setup" })).toHaveCount(0);
    await page.keyboard.press("Escape");
  });

  for (const path of ["/app/expenses", "/app/audit"]) {
    test(`${path} shows a no-access screen`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText("You don't have access to this page")).toBeVisible();
    });
  }

  test("/app/setup does not open Business Setup for staff", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("staff cannot void payments, manage employees or adjust stock", async ({ page }) => {
    await page.goto("/app/payments");
    await expect(page.getByRole("button", { name: /Void transaction/ })).toHaveCount(0);
    await page.goto("/app/employees");
    await expect(page.getByRole("button", { name: "Add Employee" })).toHaveCount(0);
    await page.goto("/app/inventory");
    await expect(page.getByRole("button", { name: /Adjust stock for/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Track an item" })).toHaveCount(0);
  });

  test("staff can still ring up a sale", async ({ page }) => {
    await page.goto("/app/pos");
    await page.getByRole("button", { name: /Lumpia/ }).first().click();
    await page.getByRole("button", { name: /Checkout/ }).click();
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByText(/Sale completed/)).toBeVisible();
  });
});
