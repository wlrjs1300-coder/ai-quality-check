import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./tests/capture",
  testMatch: "portfolio-screenshots.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "test-results/portfolio-capture",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    headless: true,
    screenshot: "off",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3001",
    url: `${baseURL}/projects`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_BASE_URL: "/api/backend",
      BACKEND_API_BASE_URL: "http://127.0.0.1:8000",
      RUNTIME_VALIDATION_ENABLED: "false",
    },
  },
});
