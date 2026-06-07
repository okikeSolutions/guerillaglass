import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const config = defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: path.resolve(rootDirectory, "../../project.inlang"),
      outdir: path.resolve(rootDirectory, "src/paraglide"),
      strategy: ["localStorage", "baseLocale"],
      emitGitIgnore: false,
    }),
    devtools(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
});

export default config;
