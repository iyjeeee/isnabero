import { test, expect, rowFor } from "./fixtures";

test.describe("employees", () => {
  test("adds, edits and removes an employee; the last owner is protected", async ({ page }) => {
    await page.goto("/app/employees");
    await page.getByRole("button", { name: "Add Employee" }).click();
    const form = page.getByRole("dialog", { name: "Add employee" });
    await form.getByLabel("Full name").fill("E2E Newhire");
    await form.getByLabel("Role").selectOption({ label: "Staff" });
    await form.getByRole("button", { name: "Add employee" }).click();
    await expect(page.getByText("E2E Newhire added to the team")).toBeVisible();
    await expect(rowFor(page, "E2E Newhire")).toContainText("Staff");

    await page.getByRole("button", { name: "Edit E2E Newhire" }).click();
    const edit = page.getByRole("dialog", { name: "Edit employee" });
    await edit.getByLabel("Role").selectOption({ label: "Admin" });
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(rowFor(page, "E2E Newhire")).toContainText("Admin");

    await page.getByRole("button", { name: "Remove E2E Newhire" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("E2E Newhire removed")).toBeVisible();
    await expect(rowFor(page, "E2E Newhire")).toHaveCount(0);

    // you cannot remove yourself (no delete button on your own row)
    await expect(page.getByRole("button", { name: "Remove Juan Dela Cruz" })).toHaveCount(0);
  });

  test("filters by role and searches by name", async ({ page }) => {
    await page.goto("/app/employees");
    await page.getByRole("button", { name: "Staff", exact: true }).click();
    await expect(rowFor(page, "Pedro Reyes")).toBeVisible();
    await expect(rowFor(page, "Maria Santos")).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await page.getByPlaceholder("Search employees…").fill("ana");
    await expect(rowFor(page, "Ana Lopez")).toBeVisible();
    await expect(rowFor(page, "Pedro Reyes")).toHaveCount(0);
  });
});
