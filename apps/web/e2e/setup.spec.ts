import { test, expect, sidebar } from "./fixtures";

test.describe("business setup", () => {
  test("renames the business and the sidebar follows", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /Business Setup/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Business Setup" })).toBeVisible();
    await page.getByLabel("Business name").fill("E2E Cafe");
    // wizard: Business -> Modules -> Review -> Save
    for (let step = 0; step < 4; step++) {
      const next = page.getByRole("button", { name: /^(Next|Save|Finish setup)/ });
      if (!(await next.first().isVisible().catch(() => false))) break;
      const label = (await next.first().innerText()).trim();
      await next.first().click();
      if (/Save|Finish/.test(label)) break;
    }
    await expect(page.getByText("Business setup saved")).toBeVisible();
    await expect(page.locator("aside").getByText("E2E Cafe")).toBeVisible();
    await expect(sidebar(page)).toBeVisible();
  });
});
