import { test, expect, goTo } from "./fixtures";

test.describe("cash close", () => {
  test("counts the drawer, shows over/short, saves it to history and starts the next period fresh", async ({ page }) => {
    // a cash sale first so there is something to count
    await page.goto("/app/pos");
    await page.getByRole("button", { name: /Sisig/ }).first().click();
    await page.getByRole("button", { name: /Checkout/ }).click();
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByText(/Sale completed/)).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();

    await goTo(page, "Cash Close");
    await expect(page.getByRole("heading", { level: 1, name: "Cash Close" })).toBeVisible();
    await expect(page.getByText("No closes yet")).toBeVisible();

    await page.getByLabel("Starting cash").fill("1000");
    await page.getByLabel("Counted cash").fill("0");
    await expect(page.getByTestId("expected-cash")).toContainText("₱");
    await expect(page.getByText(/Short by ₱/).first()).toBeVisible();
    await page.getByLabel("Counted cash").fill("100000");
    await expect(page.getByText(/Over by ₱/).first()).toBeVisible();
    await page.getByLabel("Counted cash").fill("0");
    await page.getByLabel(/Note/).fill("E2E close");

    await page.getByRole("button", { name: "Close cash" }).click();
    await page.getByRole("button", { name: "Yes, close cash" }).click();
    await expect(page.getByText(/Cash closed — Short by/).first()).toBeVisible();

    // history has the close; its details open on click
    const row = page.getByRole("row").filter({ hasText: "Short by" });
    await expect(row).toHaveCount(1);
    await row.click();
    const dialog = page.getByRole("dialog", { name: /./ });
    await expect(dialog).toContainText("E2E close");
    await expect(dialog).toContainText("Closed by");
    await page.keyboard.press("Escape");

    // next period starts from the last count, with no cash movement yet
    await expect(page.getByLabel("Starting cash")).toHaveValue("0");
    await expect(page.getByTestId("expected-cash")).toHaveText("₱0.00");
  });
});
