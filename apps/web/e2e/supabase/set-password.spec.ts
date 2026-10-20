import { test, expect } from "../fixtures";

test.describe("invite link landing page", () => {
  test("opens without signing in, and says so when the link has no valid session", async ({ page }) => {
    await page.goto("/set-password");
    await expect(page.getByRole("heading", { level: 1, name: "Set your password" })).toBeVisible();
    await expect(page.getByText(/invite link has expired or was already used/)).toBeVisible({ timeout: 8000 });
    await page.getByRole("link", { name: "Go to sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
