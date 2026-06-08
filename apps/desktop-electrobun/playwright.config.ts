import process from "node:process";
import { defineConfig, devices } from "@playwright/test";

const devServerPort = Number.parseInt(process.env.PORT ?? "5173", 10);
const devServerURL = `http://127.0.0.1:${devServerPort}`;

export default defineConfig({
  testDir: "./tests/ui",
  testMatch: "**/*.smoke.ts",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: devServerURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    command: "bun run hmr --host 127.0.0.1",
    url: devServerURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
