import { test, expect, goTo } from "./fixtures";

test.describe("catalog: add, edit, sell-out and delete", () => {
  test("creates a bundle with inclusions, edits it, marks it sold out and deletes it", async ({ page }) => {
    await page.goto("/app/catalog");
    await page.getByRole("button", { name: "Add offering" }).first().click();
    const form = page.getByRole("dialog", { name: "Add offering" });
    await form.getByLabel("Name", { exact: true }).fill("E2E Party Pack");
    await form.getByLabel("Type").selectOption({ label: "Bundle" });
    await form.getByLabel("Price (₱)").fill("1250");
    await form.getByLabel(/Duration in minutes/).fill("30");
    await form.getByRole("button", { name: "Add inclusion" }).click();
    await form.getByPlaceholder("Label").fill("Unli shots");
    await form.getByRole("button", { name: "Save offering" }).click();
    await expect(page.getByText("E2E Party Pack added to catalog")).toBeVisible();

    const card = page.getByTitle("View details for E2E Party Pack");
    await expect(card).toContainText("₱1,250.00");
    await expect(card).toContainText("Unli shots");

    // edit: change the price
    await page.getByRole("button", { name: "Edit E2E Party Pack" }).click();
    const edit = page.getByRole("dialog", { name: "Edit offering" });
    await edit.getByLabel("Price (₱)").fill("1300");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("E2E Party Pack updated")).toBeVisible();
    await expect(card).toContainText("₱1,300.00");

    // sold out, and it disappears from POS
    await card.getByRole("button", { name: "Mark sold out" }).click();
    await expect(card).toContainText("Sold out");
    await goTo(page, "POS / Cashier");
    await expect(page.getByRole("button", { name: /E2E Party Pack/ })).toHaveCount(0);

    // delete (no sales or bookings yet)
    await goTo(page, "Catalog");
    await page.getByRole("button", { name: "Delete E2E Party Pack" }).click();
    await page.getByRole("button", { name: "Delete offering" }).click();
    await expect(page.getByText("E2E Party Pack deleted")).toBeVisible();
    await expect(page.getByTitle("View details for E2E Party Pack")).toHaveCount(0);
  });

  test("an offering with sales cannot be deleted", async ({ page }) => {
    await page.goto("/app/catalog");
    await page.getByRole("button", { name: "Delete Sisig" }).click();
    await page.getByRole("button", { name: "Delete offering" }).click();
    await expect(page.getByTitle("View details for Sisig")).toBeVisible();
    await expect(page.getByText(/mark it sold out|in use|sales or bookings/i).first()).toBeVisible();
  });

  test("validates the form and filters by type and search", async ({ page }) => {
    await page.goto("/app/catalog");
    await page.getByRole("button", { name: "Add offering" }).first().click();
    const form = page.getByRole("dialog", { name: "Add offering" });
    await form.getByRole("button", { name: "Save offering" }).click();
    await expect(form.getByText("Name is required")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Bundles" }).click();
    await expect(page.getByTitle("View details for Bundle A")).toBeVisible();
    await expect(page.getByTitle("View details for Sisig")).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByPlaceholder("Search offerings…").fill("lumpia");
    await expect(page.getByTitle("View details for Lumpia (6 pcs)")).toBeVisible();
    await expect(page.getByTitle("View details for Sisig")).toHaveCount(0);
  });
});
