import { test, expect } from "./fixtures";

// local "YYYY-MM-DDTHH:mm" for a datetime-local input, some days ahead at an unusual time so it can't clash with seed data
function slot(daysAhead: number, hh: string, mm: string): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hh}:${mm}`;
}

test.describe("booking lifecycle", () => {
  test("books a package, edits it, confirms, completes — and a clash is refused", async ({ page }) => {
    await page.goto("/app/booking");
    await page.getByRole("button", { name: "New Booking" }).click();
    const form = page.getByRole("dialog", { name: "New booking" });
    await form.getByLabel("Package").selectOption({ label: "Bundle A" });
    await form.getByLabel("Customer name").fill("E2E Customer");
    await form.getByLabel("Contact (optional)").fill("0917 000 0000");
    await form.getByLabel("Start time").fill(slot(5, "04", "15"));
    await form.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page.getByText("Booked E2E Customer for Bundle A")).toBeVisible();

    const card = page.getByTitle("View details for E2E Customer");
    await expect(card).toContainText("Pending");
    await expect(card).toContainText("0917 000 0000");

    // the same slot again is refused
    await page.getByRole("button", { name: "New Booking" }).click();
    const again = page.getByRole("dialog", { name: "New booking" });
    await again.getByLabel("Package").selectOption({ label: "Bundle A" });
    await again.getByLabel("Customer name").fill("E2E Clash");
    await again.getByLabel("Start time").fill(slot(5, "04", "20"));
    await again.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page.getByTitle("View details for E2E Clash")).toHaveCount(0);
    await page.keyboard.press("Escape");

    // edit the name
    await page.getByRole("button", { name: "Edit booking for E2E Customer" }).click();
    const edit = page.getByRole("dialog", { name: "Edit booking" });
    await edit.getByLabel("Customer name").fill("E2E Customer Renamed");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Booking for E2E Customer Renamed updated")).toBeVisible();

    const renamed = page.getByTitle("View details for E2E Customer Renamed");
    await renamed.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(renamed).toContainText("Confirmed");
    await renamed.getByRole("button", { name: "Mark completed" }).click();
    await expect(renamed).toContainText("Completed");

    // details dialog shows everything
    await renamed.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Bundle A");
    await expect(dialog).toContainText("0917 000 0000");
    await expect(dialog).toContainText("Completed");
  });

  test("cancels a booking after confirming the dialog", async ({ page }) => {
    await page.goto("/app/booking");
    await page.getByRole("button", { name: "New Booking" }).click();
    const form = page.getByRole("dialog", { name: "New booking" });
    await form.getByLabel("Package").selectOption({ label: "Bundle B" });
    await form.getByLabel("Customer name").fill("E2E Cancel Me");
    await form.getByLabel("Start time").fill(slot(6, "03", "05"));
    await form.getByRole("button", { name: "Confirm Booking" }).click();
    await expect(page.getByText("Booked E2E Cancel Me for Bundle B")).toBeVisible();

    const card = page.getByTitle("View details for E2E Cancel Me");
    await card.getByRole("button", { name: "Cancel booking" }).click();
    await page.getByRole("button", { name: "Yes, cancel booking" }).click();
    await expect(page.getByText("Booking for E2E Cancel Me cancelled")).toBeVisible();
    await expect(card).toContainText("Cancelled");
  });
});
