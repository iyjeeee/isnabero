import { test, expect } from "../fixtures";

// Runs in the supabase project (fake URL): the sign-in screen itself — brand panel, password reveal, error message.
test.describe("sign-in screen", () => {
  test("shows the form with the module panel on a wide screen", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".auth-panel")).toBeVisible(); // decoration only, hidden from screen readers
    await expect(page.locator(".auth-tile[data-on='true']")).toHaveCount(4);
    await expect(page.locator(".auth-tile[data-on='false']")).toHaveCount(2);
  });

  test("the eye button reveals and hides the password", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret-pass");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("a failed sign-in shows the reason in an alert and keeps the form usable", async ({ page, problems }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password", { exact: true }).fill("wrong-pass");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
    problems.length = 0; // the fake Supabase URL makes the request fail on purpose
  });

  test("on a phone the brand sits above the form and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
    await expect(page.locator(".auth-panel")).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
