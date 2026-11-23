import { defineConfig, devices } from "@playwright/test";
import { API_DIR, API_ENV, API_URL, OUTBOX, WEB_PORT, WEB_URL } from "./e2e/support/settings";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  // One worker: the API rate limits are shared by every test (same IP).
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: WEB_URL,
    locale: "fr-FR",
    timezoneId: "Africa/Conakry",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      name: "api",
      command: "node e2e/support/start-api.mjs",
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...API_ENV,
        E2E_API_DIR: API_DIR,
        E2E_OUTBOX: OUTBOX,
      },
    },
    {
      name: "web",
      command: `corepack pnpm exec vite dev --port ${WEB_PORT} --strictPort`,
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
