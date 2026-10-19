import { test, expect } from "./fixtures";

test.describe("inventory", () => {
  test("restock and damage adjust the count, a negative result is blocked, history records it", async ({ page }) => {
    await page.goto("/app/inventory");
    const sisig = page.getByRole("row", { name: /^Sisig Item / });
    await expect(sisig).toContainText("24 in stock");

    await page.getByRole("button", { name: "Adjust stock for Sisig" }).click();
    const dialog = page.getByRole("dialog", { name: "Adjust Sisig" });
    await dialog.getByLabel("What happened").selectOption({ label: "Restock (received more)" });
    await dialog.getByLabel("Quantity").fill("6");
    await expect(dialog).toContainText("New count: 30");
    await dialog.getByLabel("Reason").fill("E2E delivery");
    await dialog.getByRole("button", { name: "Save adjustment" }).click();
    await expect(sisig).toContainText("30 in stock");

    await page.getByRole("button", { name: "Adjust stock for Sisig" }).click();
    const again = page.getByRole("dialog", { name: "Adjust Sisig" });
    await again.getByLabel("What happened").selectOption({ label: "Damaged / spoiled / lost" });
    await again.getByLabel("Quantity").fill("500");
    await expect(again).toContainText("not allowed");
    await again.getByLabel("Quantity").fill("4");
    await again.getByLabel("Reason").fill("E2E spoiled");
    await again.getByRole("button", { name: "Save adjustment" }).click();
    await expect(sisig).toContainText("26 in stock");

    // the newest history line is the damage, with its full reason in the details
    await page.getByRole("row", { name: /E2E spoiled|Damaged/ }).first().click();
    const detail = page.getByRole("dialog");
    await expect(detail).toContainText("Stock change");
    await expect(detail).toContainText("E2E spoiled");
    await expect(detail).toContainText("-4");
  });

  test("low and out-of-stock filters", async ({ page }) => {
    await page.goto("/app/inventory");
    await page.getByRole("button", { name: "Out", exact: true }).click();
    await expect(page.getByRole("row", { name: /^Halo-Halo Item / })).toBeVisible();
    await expect(page.getByRole("row", { name: /^Sisig Item / })).toHaveCount(0);
  });
});
