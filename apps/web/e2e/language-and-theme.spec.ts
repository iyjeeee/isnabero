import { test, expect } from "./fixtures";

test.describe("theme and settings (settings modal)", () => {
  test("offers theme and Business Setup only, no language choice", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Light" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Business Setup/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Filipino|English/ })).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("toggles dark mode", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(dialog.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("Business Setup opens from the modal and closes it", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Business Setup/ }).click();
    await expect(page.getByRole("dialog", { name: "Business Setup" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Settings" })).toHaveCount(0);
  });
});
