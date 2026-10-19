import { test, expect } from "../fixtures";

// Runs against a dev server started with VITE_DATA_SOURCE=supabase and a fake URL. It proves the app really switches to
// Supabase mode (a regression test: the switch once silently stayed on mock data) and sends signed-out visitors to /login.
test.describe("supabase mode login gate", () => {
  test("a signed-out visitor is sent to the login page, not shown sample data", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Sample data")).toHaveCount(0);
  });

  test("protected pages redirect too", async ({ page }) => {
    for (const path of ["/app/pos", "/app/payments", "/app/setup"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
