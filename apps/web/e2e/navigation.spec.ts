import { test, expect, sidebar } from "./fixtures";

test.describe("sidebar and navigation", () => {
  test("groups pages by task and pins Business Setup at the bottom", async ({ page }) => {
    await page.goto("/app");
    const nav = sidebar(page);
    for (const heading of ["Sales", "Products & Stock", "Team", "Money & Reports"]) await expect(nav.getByText(heading, { exact: true })).toBeVisible();
    for (const link of ["Dashboard", "POS / Cashier", "Booking", "Payment Records", "Catalog", "Inventory", "Employees", "Schedule", "Expenses", "Reports", "Audit Log"]) {
      await expect(nav.getByRole("link", { name: link })).toBeVisible();
    }
    // old "Core" / "Modules" headings are gone
    await expect(nav.getByText("Core", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Modules", { exact: true })).toHaveCount(0);
    // settings sit outside the grouped list
    await expect(nav.getByRole("link", { name: "Business Setup" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Business Setup" })).toBeVisible();
  });

  test("shows the sample-data badge in mock mode and explains sign out", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByText(/demo mode/i)).toBeVisible();
  });

  const pages: Array<[string, RegExp]> = [
    ["/app", /Dashboard|Welcome/i],
    ["/app/pos", /POS/],
    ["/app/booking", /Booking/],
    ["/app/payments", /Payment Records/],
    ["/app/catalog", /Catalog/],
    ["/app/inventory", /Inventory/],
    ["/app/employees", /Employees/],
    ["/app/schedule", /Schedule/],
    ["/app/expenses", /Expenses/],
    ["/app/reports", /Reports/],
    ["/app/audit", /Audit Log/],
    ["/app/setup", /Setup|Business/],
  ];
  for (const [path, heading] of pages) {
    test(`${path} loads without errors`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    });
  }

  test("collapses and expands the sidebar", async ({ page }) => {
    await page.goto("/app");
    await page.getByTitle("Collapse sidebar").click();
    await expect(page.getByTitle("Expand sidebar")).toBeVisible();
    await expect(sidebar(page).getByText("Sales", { exact: true })).toHaveCount(0);
  });
});
