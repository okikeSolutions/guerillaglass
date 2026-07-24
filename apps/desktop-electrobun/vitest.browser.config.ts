import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      "@": resolvePath("./src/mainview"),
      "@lib": resolvePath("./src/mainview/lib"),
      "@shared": resolvePath("./src/shared"),
      "@studio": resolvePath("./src/mainview/app/studio"),
    },
  },
  test: {
    include: ["tests/ui/**/*.browser.test.{ts,tsx}"],
    setupFiles: ["tests/ui/browserSetup.js"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        {
          browser: "chromium",
          viewport: { width: 1440, height: 1000 },
        },
      ],
      screenshotDirectory: "test-results/screenshots",
      trace: "retain-on-failure",
    },
  },
});
