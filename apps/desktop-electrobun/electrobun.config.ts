import { readFileSync } from "node:fs";
import type { ElectrobunConfig } from "electrobun";

const packageJson = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as {
  version: string;
};

export default {
  app: {
    name: "Guerillaglass",
    identifier: "com.okikeSolutions.guerillaglass.desktop",
    version: packageJson.version,
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: false,
    },
    linux: {
      bundleCEF: false,
    },
    win: {
      bundleCEF: false,
    },
  },
  scripts: {
    // Mark .gglassproj as a macOS package document type in generated Info.plist files.
    postBuild: "scripts/configure-macos-project-package.ts",
    postWrap: "scripts/configure-macos-project-package.ts",
  },
} satisfies ElectrobunConfig;
