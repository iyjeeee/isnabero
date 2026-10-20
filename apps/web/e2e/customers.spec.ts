import { test, expect, goTo } from "./fixtures";

test.describe("customers", () => {
  test("lists customers from bookings, searches them and shows their history", async ({ page }) => {
    await page.goto("/app");
    await goTo(page, "Customers");
    await expect(page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();

    const firstName = (await rows.first().locator("td").first().innerText()).trim();
    await page.getByLabel("Search customers").fill(firstName);
    await expect(rows.first()).toContainText(firstName);

    await rows.first().click();
    const dialog = page.getByRole("dialog", { name: firstName });
    await expect(dialog).toContainText("Booking history");
    await expect(dialog).toContainText("Total spent");
    await page.keyboard.press("Escape");

    await page.getByLabel("Search customers").fill("zzzz-nobody");
    await expect(page.getByText("No matches")).toBeVisible();
  });
});
