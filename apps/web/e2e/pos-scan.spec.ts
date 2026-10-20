import { test, expect, goTo } from "./fixtures";

test.describe("POS barcode scanning and shortcuts", () => {
  test("a scan adds the item, / focuses search, Enter in search adds, F9 opens checkout", async ({ page }) => {
    await page.goto("/app/pos");
    await expect(page.getByRole("button", { name: /Sisig/ }).first()).toBeVisible();

    // a scanner types the code quickly and presses Enter, with no field focused
    await page.keyboard.type("4800001000011");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("1");
    await page.keyboard.type("4800001000011");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("2");

    // an unknown code says so
    await page.keyboard.type("0000000000");
    await page.keyboard.press("Enter");
    await expect(page.getByText("No item has the barcode 0000000000.")).toBeVisible();

    // "/" jumps to search; Enter adds the matching barcode and clears the box
    await page.keyboard.press("/");
    await expect(page.getByPlaceholder("Search items…")).toBeFocused();
    await page.keyboard.type("4800001000028");
    await page.keyboard.press("Enter");
    await expect(page.getByPlaceholder("Search items…")).toHaveValue("");
    await expect(page.getByText("Lumpia (6 pcs)").last()).toBeVisible();

    // F9 opens checkout
    await page.keyboard.press("Escape");
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("F9");
    await expect(page.getByRole("dialog", { name: "Complete sale" })).toBeVisible();
  });

  test("a barcode can be saved on an item and cannot be reused", async ({ page }) => {
    await page.goto("/app/catalog");
    await page.getByRole("button", { name: "Add offering" }).first().click();
    const form = page.getByRole("dialog", { name: "Add offering" });
    await form.getByLabel("Name").fill("E2E scan item");
    await form.getByLabel(/Barcode/).fill("4800001000011"); // already Sisig's
    await form.getByLabel("Price").fill("10");
    await form.getByRole("button", { name: "Save offering" }).click();
    await expect(page.getByText("Another item already uses this barcode.")).toBeVisible();

    await form.getByLabel(/Barcode/).fill("E2E-CODE-1");
    await form.getByRole("button", { name: "Save offering" }).click();
    await expect(form).toBeHidden();
    await goTo(page, "POS / Cashier");
    await expect(page.getByRole("button", { name: /^E2E scan item/ })).toBeVisible(); // wait for the items to load before scanning
    await page.keyboard.type("e2e-code-1"); // case does not matter
    await page.keyboard.press("Enter");
    await expect(page.getByRole("spinbutton", { name: "Quantity" })).toHaveValue("1");
  });
});
