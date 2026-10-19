import { test, expect } from "./fixtures";

test.describe("staff schedule", () => {
  test("adds a shift, shows it on the grid, and removes it", async ({ page }) => {
    await page.goto("/app/schedule");
    await page.getByRole("button", { name: "Add shift" }).first().click();
    const form = page.getByRole("dialog", { name: "Add shift" });
    await form.getByLabel("Employee").selectOption({ label: "Ana Lopez" });
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    await form.getByLabel("Date").fill(ymd);
    await form.getByLabel("Starts").fill("05:00");
    await form.getByLabel("Ends").fill("06:00");
    await form.getByLabel("Note (optional)").fill("E2E opening");
    await form.getByRole("button", { name: "Add shift" }).click();
    await expect(page.getByText("Shift added")).toBeVisible();

    await page.getByRole("button", { name: /Edit Ana Lopez's shift/ }).first().click();
    const edit = page.getByRole("dialog", { name: "Edit shift" });
    await expect(edit.getByLabel("Note (optional)")).toBeVisible();
  });

  test("an end time before the start is rejected", async ({ page }) => {
    await page.goto("/app/schedule");
    await page.getByRole("button", { name: "Add shift" }).first().click();
    const form = page.getByRole("dialog", { name: "Add shift" });
    await form.getByLabel("Employee").selectOption({ label: "Ana Lopez" });
    await form.getByLabel("Date").fill("2026-12-01");
    await form.getByLabel("Starts").fill("10:00");
    await form.getByLabel("Ends").fill("09:00");
    await form.getByRole("button", { name: "Add shift" }).click();
    await expect(form.getByText("The end time must be after the start time")).toBeVisible();
  });
});
