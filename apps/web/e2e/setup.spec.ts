import { test, expect, sidebar } from "./fixtures";

test.describe("business setup", () => {
  test("renames the business and the sidebar follows", async ({ page }) => {
    await page.goto("/app");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("dialog").getByRole("button", { name: /Business Setup/ }).click();
    const setup = page.getByRole("dialog", { name: "Business Setup" });
    await expect(setup).toBeVisible();
    await setup.getByLabel("Business name").fill("E2E Cafe");
    // wizard: Business -> Modules -> Review -> Save
    for (let step = 0; step < 4; step++) {
      const next = page.getByRole("button", { name: /^(Next|Save|Finish setup)/ });
      if (!(await next.first().isVisible().catch(() => false))) break;
      const label = (await next.first().innerText()).trim();
      await next.first().click();
      if (/Save|Finish/.test(label)) break;
    }
    await expect(page.getByText("Business setup saved")).toBeVisible();
    await expect(setup).toHaveCount(0);
    await expect(page.locator("aside").getByText("E2E Cafe")).toBeVisible();
    await expect(sidebar(page)).toBeVisible();
  });

  test("receipt details are the last step: not shown earlier, saved with Finish, and kept next time", async ({ page }) => {
    await page.goto("/app");
    const open = async () => {
      await page.getByRole("button", { name: "Settings" }).click();
      await page.getByRole("dialog").getByRole("button", { name: /Business Setup/ }).click();
      return page.getByRole("dialog", { name: "Business Setup" });
    };
    let setup = await open();
    await expect(setup.getByRole("listitem")).toHaveCount(4);
    await expect(setup.getByLabel("Address")).toHaveCount(0); // not on step 1
    await setup.getByRole("button", { name: /Next/ }).click();
    await setup.getByRole("button", { name: /Next/ }).click();
    await expect(setup.getByLabel("Address")).toHaveCount(0); // nor on the review step
    await setup.getByRole("button", { name: /Next/ }).click();
    await setup.getByLabel("Address").fill("99 Mabini St, Manila");
    await setup.getByLabel("TIN").fill("12");
    await setup.getByRole("button", { name: "Finish setup" }).click();
    await expect(setup.getByText(/TIN/i).first()).toBeVisible(); // invalid TIN keeps the modal open on this step
    await setup.getByLabel("TIN").fill("123-456-789-000");
    await setup.getByRole("button", { name: "Finish setup" }).click();
    await expect(page.getByText("Business setup saved")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    setup = await open();
    for (let i = 0; i < 3; i++) await setup.getByRole("button", { name: /Next/ }).click();
    await expect(setup.getByLabel("Address")).toHaveValue("99 Mabini St, Manila");
  });

  test("the old /app/setup address opens the modal over the dashboard", async ({ page }) => {
    await page.goto("/app/setup");
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("dialog", { name: "Business Setup" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});
