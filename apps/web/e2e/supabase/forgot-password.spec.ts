import { test, expect } from "../fixtures";

// Runs in the supabase project (fake URL): the reset-request screen and its link from the sign-in page.
test.describe("forgot password", () => {
  test("the sign-in page links to it and it links back", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    await page.getByRole("link", { name: "Back to sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("a failed request shows the reason and keeps the form usable", async ({ page, problems }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("alert")).toBeVisible(); // the fake Supabase URL can't be reached
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeEnabled();
    problems.length = 0; // that failed request is expected here
  });

  test("a successful request confirms without saying whether the account exists", async ({ page }) => {
    await page.route("**/auth/v1/recover**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("If someone@example.com has an account");
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
