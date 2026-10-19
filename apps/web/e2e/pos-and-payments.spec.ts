import { test, expect, rowFor, goTo } from "./fixtures";

test.describe("POS sale -> payment record -> receipt -> void", () => {
  test("rings up a sale, shows its details in Payment Records, and a void restocks", async ({ page }) => {
    await page.goto("/app/pos");
    await page.getByRole("button", { name: /Sisig/ }).first().click();
    await page.getByRole("button", { name: /Sisig/ }).first().click(); // two of them
    await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("2");
    await page.getByRole("button", { name: /Checkout — ₱300/ }).click();
    await page.getByLabel("Payment method").selectOption({ label: "GCash" });
    await page.getByLabel("Reference code").fill("E2E-SALE-1");
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByText(/Sale completed — ₱300/)).toBeVisible();

    // the receipt opens right after checkout
    await expect(page.getByRole("dialog").getByText(/Sisig/).first()).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).first().click();

    // stock went down by two
    await goTo(page, "Inventory");
    await expect(page.getByRole("row", { name: /^Sisig Item / })).toContainText("22 in stock");

    // Payment Records: what was sold, who rang it up, and every detail on click
    await goTo(page, "Payment Records");
    const row = rowFor(page, "E2E-SALE-1");
    await expect(row).toContainText("2 × Sisig");
    await expect(row).toContainText("₱300.00");
    await row.click();
    const dialog = page.getByRole("dialog", { name: "Payment details" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("2 × Sisig");
    await expect(dialog).toContainText("Juan Dela Cruz");
    await expect(dialog).toContainText("GCash");
    await expect(dialog).toContainText("E2E-SALE-1");
    await expect(dialog).toContainText("Active");
    await dialog.getByRole("button", { name: "View receipt" }).click();
    await expect(page.getByRole("dialog", { name: /Receipt/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // void from the row's own button: it must not open the details dialog
    await rowFor(page, "E2E-SALE-1").getByRole("button", { name: /Void transaction/ }).click();
    await expect(page.getByRole("dialog", { name: "Payment details" })).toHaveCount(0);
    await page.getByRole("button", { name: "Void transaction" }).click();
    await expect(page.getByText("Transaction voided")).toBeVisible();
    await expect(rowFor(page, "E2E-SALE-1")).toHaveCount(0);
    await page.getByLabel("Show voided").check();
    await expect(rowFor(page, "E2E-SALE-1")).toContainText("Voided");

    // the void put the two Sisig back
    await goTo(page, "Inventory");
    await expect(page.getByRole("row", { name: /^Sisig Item / })).toContainText("24 in stock");
  });

  test("a GCash payment needs a reference code and keeps it on the record", async ({ page }) => {
    await page.goto("/app/pos");
    await page.getByRole("button", { name: /Lumpia/ }).first().click();
    await page.getByRole("button", { name: /Checkout/ }).click();
    await page.getByLabel("Payment method").selectOption({ label: "GCash" });
    await expect(page.getByRole("button", { name: "Confirm payment" })).toBeDisabled();
    await page.getByLabel("Reference code").fill("GC-4471");
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByText(/Sale completed/)).toBeVisible();
    await page.keyboard.press("Escape");

    await goTo(page, "Payment Records");
    await expect(rowFor(page, "GC-4471")).toContainText("Lumpia (6 pcs)");
  });

  test("an out-of-stock item cannot be added to the cart", async ({ page }) => {
    await page.goto("/app/pos");
    await expect(page.getByRole("button", { name: /Halo-Halo/ })).toBeDisabled();
  });
});
