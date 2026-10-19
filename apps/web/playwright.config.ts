import { defineConfig, devices } from "@playwright/test";

// End-to-end tests. Three dev servers run side by side so each data mode can be tested without touching the others:
//   5199  mock data, owner session      -> e2e/*.spec.ts            (the whole app, fast, no backend needed)
//   5198  mock data, staff session      -> e2e/staff/*.spec.ts      (role-gated screens)
//   5197  Supabase mode                 -> e2e/supabase/*.spec.ts   (fake URL: proves the login gate; live tests need E2E_LIVE=1)
// Run: pnpm --filter @isnabero/web e2e   (first time only: pnpm exec playwright install chromium)
// In a sandbox with a preinstalled Chromium, set PW_CHROMIUM_PATH to its executable.
const live = process.env.E2E_LIVE === "1";
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

const server = (port: number, env: Record<string, string>) => ({
  command: `pnpm exec vite --port ${port} --strictPort`,
  url: `http://localhost:${port}`,
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
  env,
});

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  outputDir: "e2e-results",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath, args: process.env.PW_NO_SANDBOX ? ["--no-sandbox"] : [] },
  },
  projects: [
    { name: "owner", testMatch: /e2e\/[^/]+\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5199" } },
    { name: "mobile", testMatch: /e2e\/mobile\/.*\.spec\.ts$/, use: { ...devices["Pixel 7"], baseURL: "http://localhost:5199" } },
    { name: "staff", testMatch: /e2e\/staff\/.*\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5198" } },
    { name: "supabase", testMatch: /e2e\/supabase\/.*\.spec\.ts$/, use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5197" } },
  ],
  webServer: [
    server(5199, { VITE_DATA_SOURCE: "mock", VITE_MOCK_ROLE: "owner" }),
    server(5198, { VITE_DATA_SOURCE: "mock", VITE_MOCK_ROLE: "staff" }),
    // live: the real project from .env.local; otherwise a fake URL so no request ever leaves the machine
    server(5197, live ? { VITE_DATA_SOURCE: "supabase" } : { VITE_DATA_SOURCE: "supabase", VITE_SUPABASE_URL: "http://127.0.0.1:9", VITE_SUPABASE_ANON_KEY: "e2e-placeholder-key" }),
  ],
});
