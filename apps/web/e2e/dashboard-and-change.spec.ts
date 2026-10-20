import { test, expect } from "./fixtures";

test.describe("dashboard comparison and checkout change", () => {
  test("the dashboard compares today with yesterday and lists today's bookings", async ({ page }) => {
    await page.goto("/app");
    await expect(page.getByText("Today's Sales")).toBeVisible();
    await expect(page.getByText(/by this time yesterday/)).toBeVisible();
    await expect(page.getByText(/vs yesterday/).first()).toBeVisible();
    await expect(page.getByText("Today's bookings")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Booking" })).toBeVisible();
  });

  test("a cash sale shows change due, blocks a short payment and clears between sales", async ({ page }) => {
    await page.goto("/app/pos");
    await page.getByRole("button", { name: /Sisig/ }).first().click(); // ₱150
    await page.getByRole("button", { name: /Checkout — ₱150/ }).click();

    await page.getByLabel("Cash received").fill("100");
    await expect(page.getByText("Still owed by the customer")).toBeVisible();
    await expect(page.getByTestId("change-due")).toHaveText("₱50.00");
    await expect(page.getByRole("button", { name: "Confirm payment" })).toBeDisabled();

    await page.getByLabel("Cash received").fill("200");
    await expect(page.getByText("Change to give back")).toBeVisible();
    await expect(page.getByTestId("change-due")).toHaveText("₱50.00");
    await expect(page.getByRole("button", { name: "Confirm payment" })).toBeEnabled();

    await page.getByRole("button", { name: "Exact" }).click();
    await expect(page.getByTestId("change-due")).toHaveText("₱0.00");

    // other payment methods have no cash box
    await page.getByLabel("Payment method").selectOption({ label: "GCash" });
    await expect(page.getByLabel("Cash received")).toHaveCount(0);
    await page.getByLabel("Payment method").selectOption({ label: "Cash" });
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByText(/Sale completed/)).toBeVisible();
  });
});
