import nkzw from "@nkzw/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [nkzw],
  ignorePatterns: [
    "apps/desktop-electrobun/build/**",
    "apps/desktop-electrobun/dist/**",
    "apps/desktop-electrobun/playwright-report/**",
    "apps/desktop-electrobun/test-results/**",
  ],
  rules: {
    "react/exhaustive-deps": "deny",
    "react/rules-of-hooks": "deny",
    "import-x/no-namespace": "off",
    "perfectionist/sort-enums": "off",
    "perfectionist/sort-heritage-clauses": "off",
    "perfectionist/sort-interfaces": "off",
    "perfectionist/sort-jsx-props": "off",
    "perfectionist/sort-object-types": "off",
    "perfectionist/sort-objects": "off",
    "@typescript-eslint/array-type": "off",
  },
  overrides: [
    {
      files: ["apps/desktop-electrobun/src/bun/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
});
