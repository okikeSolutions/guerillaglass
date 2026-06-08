import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const devServerPort = Number.parseInt(process.env.PORT ?? "5173", 10);
if (!Number.isInteger(devServerPort) || devServerPort < 1 || devServerPort > 65_535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: path.resolve(rootDirectory, "../../project.inlang"),
      outdir: path.resolve(rootDirectory, "src/paraglide"),
      strategy: ["localStorage", "baseLocale"],
      emitGitIgnore: false,
    }),
    react(),
    tailwindcss(),
  ],
  root: "src/mainview",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }
          if (id.includes("/@tanstack/")) {
            return "vendor-tanstack";
          }
          if (id.includes("/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("/effect/")) {
            return "vendor-effect";
          }
          return;
        },
      },
    },
  },
  server: {
    port: devServerPort,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src/mainview"),
      "@lib": path.resolve(rootDirectory, "src/mainview/lib"),
      "@shared": path.resolve(rootDirectory, "src/shared"),
      "@studio": path.resolve(rootDirectory, "src/mainview/app/studio"),
    },
  },
});
