import { defineConfig } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

const browserChannel =
  process.env.PLAYWRIGHT_BROWSER_CHANNEL ?? "chrome";

const headless =
  process.env.PLAYWRIGHT_HEADLESS?.toLowerCase() !== "false";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL,
    channel: browserChannel,
    headless,
    viewport: {
      width: 1440,
      height: 900,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- -H 127.0.0.1 -p 3001",
    url: `${baseURL}/runtime-validation`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      RUNTIME_VALIDATION_ENABLED: "true",
    },
  },
});