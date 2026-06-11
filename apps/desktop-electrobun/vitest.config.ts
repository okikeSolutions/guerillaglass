import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolvePath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolvePath("./src/mainview"),
      "@lib": resolvePath("./src/mainview/lib"),
      "@shared": resolvePath("./src/shared"),
      "@studio": resolvePath("./src/mainview/app/studio"),
    },
  },
  test: {
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/ui/**/*.smoke.ts", "tests/ui/**/*.browser.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "../../target/coverage/typescript",
      exclude: ["src/paraglide/**", "tests/**", "build/**", "dist/**"],
    },
  },
});
