import { test, expect } from "./fixtures";

// the navigation landmark is renamed with the language, so find it by role only
const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation");

test.describe("language and theme", () => {
  test("switches the whole app to Filipino and back", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: /Language: English/ }).click();
    await expect(nav(page).getByText("Benta", { exact: true })).toBeVisible();
    await expect(nav(page).getByRole("link", { name: "Mga Tala ng Bayad" })).toBeVisible();
    await nav(page).getByRole("link", { name: "Mga Tala ng Bayad" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Bayad/);
    await page.getByRole("button", { name: /Wika|Language/ }).click();
    await expect(nav(page).getByText("Sales", { exact: true })).toBeVisible();
  });

  test("toggles dark mode", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });
});
