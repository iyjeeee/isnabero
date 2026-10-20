import { test, expect } from "./fixtures";

// the navigation landmark is renamed with the language, so find it by role only
const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation");

test.describe("language and theme (settings modal)", () => {
  test("switches the whole app to Filipino and back", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    await dialog.getByRole("button", { name: "Filipino" }).click();
    await expect(dialog.getByRole("button", { name: "Filipino" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(nav(page).getByText("Benta", { exact: true })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Mga Tala ng Bayad" })).toBeVisible();
    await nav(page).getByRole("link", { name: "Mga Tala ng Bayad" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bayad/);
    await page.getByRole("button", { name: "Mga Setting" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "English" }).click();
    await page.keyboard.press("Escape");
    await expect(nav(page).getByText("Sales", { exact: true })).toBeVisible();
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
    await page.getByRole("dialog").getByRole("link", { name: /Business Setup/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Business Setup" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
