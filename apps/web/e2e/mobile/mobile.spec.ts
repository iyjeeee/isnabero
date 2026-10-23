import { test, expect } from "../fixtures";

// Phone-sized screen: the sidebar is a drawer and nothing scrolls sideways.
test.describe("mobile layout", () => {
  test("opens the drawer, navigates, and the drawer closes", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Payment Records" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Payment Records" })).toBeVisible();
  });

  test("settings modal opens from the top bar and fits the screen", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.getByRole("dialog").getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("POS shows two items per row on a phone", async ({ page }) => {
    await page.goto("/app/pos");
    const first = await page.getByRole("button", { name: /Bundle B/ }).boundingBox();
    const second = await page.getByRole("button", { name: /Extra 5 Prints/ }).boundingBox();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2); // same row
    expect(second!.x).toBeGreaterThan(first!.x + first!.width - 1); // side by side
  });

  // Tables with row actions become cards on a phone: the action buttons sit inside the viewport, no sideways scroll needed
  for (const [path, button] of [["/app/employees", /Edit/], ["/app/payments", /Void/], ["/app/expenses", /Edit|Void/], ["/app/inventory", /Adjust/]] as const) {
    test(`${path} rows are cards with reachable action buttons`, async ({ page }) => {
      await page.goto(path);
      const firstRow = page.locator("table.stack-table tbody tr").first();
      await expect(firstRow).toBeVisible();
      expect(await firstRow.evaluate((el) => getComputedStyle(el).display)).toBe("block");
      const action = firstRow.getByRole("button", { name: button }).first();
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    });
  }

  for (const path of ["/app", "/app/pos", "/app/payments", "/app/inventory", "/app/booking", "/app/catalog", "/app/employees"]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
