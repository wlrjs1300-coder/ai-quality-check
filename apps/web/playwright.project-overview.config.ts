import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "project-overview-polish.spec.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "test-results",
  use: { baseURL, channel: "chrome", headless: true, trace: "retain-on-failure", screenshot: "only-on-failure", video: "off" },
  projects: [
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "desktop-1024", use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 900 } } },
    { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 900 } } },
    { name: "mobile-390", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 900 } } },
  ],
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3001",
    url: `${baseURL}/projects`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NEXT_PUBLIC_API_BASE_URL: "/api/backend", BACKEND_API_BASE_URL: "http://127.0.0.1:8000", RUNTIME_VALIDATION_ENABLED: "false" },
  },
});
