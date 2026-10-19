import { test as base, expect, type Page } from "@playwright/test";

// test: every spec fails if the page logs a console error or throws — a quiet way to catch broken screens and failed requests
export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        // "Failed to load resource" lines carry no URL (and fonts/CDNs may be unreachable offline); same-origin failures are checked below
        if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) problems.push(`console: ${message.text()}`);
      });
      const sameOrigin = (url: string) => new URL(url).origin === new URL(page.url() || "http://localhost").origin || url.startsWith("http://localhost");
      page.on("response", (response) => {
        if (response.status() >= 400 && sameOrigin(response.url())) problems.push(`http ${response.status()}: ${response.url()}`);
      });
      page.on("requestfailed", (request) => {
        if (sameOrigin(request.url()) && request.failure()?.errorText !== "net::ERR_ABORTED") problems.push(`request failed: ${request.url()}`);
      });
      await use(problems);
      expect(problems, "no console errors or uncaught exceptions").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

// openPage: go to an in-app path and wait for the page heading (each page renders one h1)
export async function openPage(page: Page, path: string, heading: RegExp | string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
}

// sidebar: the main navigation landmark
export const sidebar = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });

// rowFor: the table row (or card) containing some text
export const rowFor = (page: Page, text: string | RegExp) => page.getByRole("row").filter({ hasText: text });

// goTo: client-side navigation through the sidebar. Use this (not page.goto) after changing data in mock mode —
// a full reload resets the in-memory mock database.
export async function goTo(page: Page, linkName: string) {
  await sidebar(page).getByRole("link", { name: linkName }).click();
}
