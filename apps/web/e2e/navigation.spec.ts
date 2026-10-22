import { test, expect, sidebar } from "./fixtures";

test.describe("sidebar and navigation", () => {
  test("groups pages by task and keeps Business Setup in the top bar", async ({ page }) => {
    await page.goto("/app");
    const nav = sidebar(page);
    for (const heading of ["Sales", "Products & Stock", "Team", "Money & Reports"]) await expect(nav.getByText(heading, { exact: true })).toBeVisible();
    for (const link of ["Dashboard", "POS / Cashier", "Booking", "Payment Records", "Cash Close", "Customers", "Catalog", "Inventory", "Employees", "Schedule", "Expenses", "Reports", "Audit Log"]) {
      await expect(nav.getByRole("link", { name: link })).toBeVisible();
    }
    // old "Core" / "Modules" headings are gone
    await expect(nav.getByText("Core", { exact: true })).toHaveCount(0);
    await expect(nav.getByText("Modules", { exact: true })).toHaveCount(0);
    // settings live in the top bar, not the sidebar
    await expect(nav.getByRole("link", { name: "Business Setup" })).toHaveCount(0);
    // the top bar shows just Settings and Sign out; theme and Business Setup sit in the settings modal
    const bar = page.locator("header");
    await expect(bar.getByRole("button", { name: "Settings" })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(bar.getByRole("link", { name: "Business Setup" })).toHaveCount(0);
    await bar.getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("dialog").getByRole("button", { name: /Business Setup/ })).toBeVisible();
  });

  test("fills the width on a wide screen: no dead gutters, and the top bar lines up with the sidebar header", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/app");
    const header = page.getByRole("heading", { level: 1, name: "Dashboard" }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    const box = (await header.boundingBox())!;
    expect(box.width).toBeGreaterThan(1400); // 1920 - 256 sidebar - 2 x 32 padding
    expect(box.x + box.width).toBeGreaterThan(1850);
    const bar = (await page.locator("header").boundingBox())!;
    const side = (await sidebar(page).locator("xpath=preceding-sibling::div[1]").boundingBox())!;
    expect(bar.height).toBe(side.height);
    // Today's bookings and Stock alerts share a row instead of two full-width bars
    const top = async (text: string) => (await page.getByText(text, { exact: true }).boundingBox())!.y;
    await expect(page.getByText("Stock alerts", { exact: true })).toBeVisible();
    await expect.poll(async () => Math.abs((await top("Today's bookings")) - (await top("Stock alerts")))).toBeLessThan(4); // polls: stats may still be loading and shifting the row
  });

  test("never shows a sidebar scrollbar, even on a short window, and the list still scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 420 });
    await page.goto("/app");
    const list = sidebar(page);
    const info = await list.evaluate((el) => ({ barWidth: (el as HTMLElement).offsetWidth - el.clientWidth, scrolls: el.scrollHeight > el.clientHeight }));
    expect(info.barWidth).toBe(0);
    expect(info.scrolls).toBe(true);
    await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
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
    ["/app/cash-close", /Cash Close/],
    ["/app/customers", /Customers/],
    ["/app/catalog", /Catalog/],
    ["/app/inventory", /Inventory/],
    ["/app/employees", /Employees/],
    ["/app/schedule", /Schedule/],
    ["/app/expenses", /Expenses/],
    ["/app/reports", /Reports/],
    ["/app/audit", /Audit Log/],
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
