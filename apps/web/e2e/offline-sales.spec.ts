import { test, expect, rowFor, goTo } from "./fixtures";

test.describe("selling without a connection", () => {
  test("a sale rung up offline waits on the device, holds its stock, and is sent once when back online", async ({ page, context }) => {
    await page.goto("/app/pos");
    await expect(page.getByRole("button", { name: /Sisig/ }).first()).toContainText("24 left");

    await context.setOffline(true);
    await expect(page.getByText("You're offline.")).toBeVisible();
    await page.getByRole("button", { name: /Sisig/ }).first().click();
    await page.getByRole("button", { name: /Sisig/ }).first().click();
    await page.getByRole("button", { name: /Checkout — ₱300/ }).click();
    await page.getByLabel("Payment method").selectOption({ label: "GCash" });
    await page.getByLabel("Reference code").fill("E2E-OFFLINE-1");
    await page.getByRole("button", { name: "Confirm payment" }).click();

    // saved on the device: no receipt yet, a bar says it is waiting, and the two units are held back from the shown stock
    await expect(page.getByText("Saved on this device").first()).toBeVisible();
    await expect(page.getByText("1 sale waiting to send")).toBeVisible();
    await expect(page.getByRole("button", { name: /Sisig/ }).first()).toContainText("22 left");
    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByRole("dialog")).toContainText("2× Sisig");
    await page.keyboard.press("Escape");

    // back online: it is sent, the bar goes away and the sale shows up in Payment Records exactly once
    await context.setOffline(false);
    await expect(page.getByText("1 offline sale sent.").first()).toBeVisible();
    await expect(page.getByText("1 sale waiting to send")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Sisig/ }).first()).toContainText("22 left");
    await goTo(page, "Payment Records");
    await expect(rowFor(page, "E2E-OFFLINE-1")).toHaveCount(1);
    await expect(rowFor(page, "E2E-OFFLINE-1")).toContainText("2 × Sisig");
  });
});
