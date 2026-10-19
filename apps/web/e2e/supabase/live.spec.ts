import { test, expect } from "../fixtures";

// LIVE tests against your real Supabase project. Skipped unless you run them on purpose:
//   E2E_LIVE=1 E2E_EMAIL=you@example.com E2E_PASSWORD=... pnpm --filter @isnabero/web e2e:live
// The project URL/key come from apps/web/.env.local. These tests only READ and sign in/out — they never change your data.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
test.skip(process.env.E2E_LIVE !== "1" || !email || !password, "set E2E_LIVE=1, E2E_EMAIL and E2E_PASSWORD to run the live tests");

test.describe("live Supabase", () => {
  test("signs in, lands in the business, visits every page, signs out", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText("Sample data")).toHaveCount(0); // real data, not the demo badge

    for (const [path, heading] of [
      ["/app", /Dashboard|Welcome/i], ["/app/pos", /POS/], ["/app/booking", /Booking/], ["/app/payments", /Payment Records/],
      ["/app/catalog", /Catalog/], ["/app/inventory", /Inventory/], ["/app/employees", /Employees/], ["/app/schedule", /Schedule/],
      ["/app/expenses", /Expenses/], ["/app/reports", /Reports/], ["/app/audit", /Audit Log/],
    ] as const) {
      await page.goto(path); // the session lives in the browser, so a full load stays signed in
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    }

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/); // the session really ended
  });

  test("a wrong password is refused with a message", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("alert").or(page.getByText(/invalid|incorrect|wrong/i))).toBeVisible();
  });
});
