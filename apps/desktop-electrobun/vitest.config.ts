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
      "@guerillaglass/engine": resolvePath("../../packages/engine/src"),
    },
  },
  test: {
    include: ["tests/**/*.vitest.ts"],
  },
});
