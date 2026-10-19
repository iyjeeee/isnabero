import { test, expect, rowFor } from "./fixtures";

// Every table row / card opens a read-only details dialog; buttons inside it keep their own behaviour.
test.describe("click a record to see every detail", () => {
  test("employees: role, access and added date; Edit does not open details", async ({ page }) => {
    await page.goto("/app/employees");
    await rowFor(page, "Maria Santos").click();
    const dialog = page.getByRole("dialog", { name: "Maria Santos" });
    await expect(dialog).toContainText("Admin");
    await expect(dialog).toContainText("Everything an owner can do");
    await expect(dialog).toContainText("Added on");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    await page.getByRole("button", { name: "Edit Maria Santos" }).click();
    await expect(page.getByRole("dialog", { name: "Edit employee" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Maria Santos" })).toHaveCount(0);
  });

  test("employees: your own row is tagged and opens from the keyboard", async ({ page }) => {
    await page.goto("/app/employees");
    const me = rowFor(page, "Juan Dela Cruz");
    await expect(me).toContainText("You");
    await me.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Juan Dela Cruz" })).toContainText("Owner");
  });

  test("expenses: shows who recorded it and the notes", async ({ page }) => {
    await page.goto("/app/expenses");
    await page.getByRole("row").nth(1).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Expense details");
    await expect(dialog).toContainText("Recorded by");
    await expect(dialog).toContainText("Expense date");
  });

  test("inventory: an item's count and recent changes, and a single stock change", async ({ page }) => {
    await page.goto("/app/inventory");
    await page.getByRole("row", { name: /^Sisig Item / }).click();
    const item = page.getByRole("dialog");
    await expect(item).toContainText("Stock details");
    await expect(item).toContainText("Recent stock changes");
    await item.getByRole("button", { name: "Close" }).first().click();

    await page.getByRole("row", { name: /\d{4}, .*Sisig/ }).first().click();
    await expect(page.getByRole("dialog")).toContainText("Stock change");
  });

  test("booking: customer, package, price and times", async ({ page }) => {
    await page.goto("/app/booking");
    await page.getByTitle(/View details for/).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Booking details");
    await expect(dialog).toContainText("Package");
    await expect(dialog).toContainText("Starts");
    await expect(dialog).toContainText("Duration");
  });

  test("catalog: price, description and inclusions; the sold-out button keeps working", async ({ page }) => {
    await page.goto("/app/catalog");
    await page.getByTitle("View details for Bundle A").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Offering details");
    await expect(dialog).toContainText("₱499.00");
    await expect(dialog).toContainText("Inclusions");
    await page.keyboard.press("Escape");

    await page.getByTitle("View details for Bundle A").getByRole("button", { name: "Mark sold out" }).click();
    await expect(page.getByText("Bundle A marked sold out")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("payments: the details column names what was sold or booked", async ({ page }) => {
    await page.goto("/app/payments");
    await expect(page.getByRole("cell", { name: "Details", exact: true })).toBeVisible();
    await page.getByRole("row").nth(1).click();
    await expect(page.getByRole("dialog", { name: "Payment details" })).toContainText("Amount");
  });
});
