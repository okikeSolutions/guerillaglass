export const config = {
  buildCommand:
    "npx convex deploy --cmd 'bun run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL",
  installCommand: "bun install",
};
