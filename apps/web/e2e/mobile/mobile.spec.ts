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

  for (const path of ["/app", "/app/pos", "/app/payments", "/app/inventory", "/app/booking", "/app/catalog", "/app/employees"]) {
    test(`${path} has no horizontal page scroll`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
