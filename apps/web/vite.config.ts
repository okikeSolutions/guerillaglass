import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
});
