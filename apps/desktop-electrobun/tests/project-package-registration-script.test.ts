import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SCRIPT_PATH = "scripts/configure-macos-project-package.ts";
const PROJECT_UTI = "com.okikeSolutions.guerillaglass.project";

const BASE_INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.okikeSolutions.guerillaglass.desktop</string>
    <key>CFBundleName</key>
    <string>Guerillaglass</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>`;

function runCommand(command: string[], env?: Record<string, string>) {
  return Bun.spawnSync(command, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
}

async function createFixtureAppBundle(
  temporaryDirectory: string,
  appName: string,
  infoPlistContents: string = BASE_INFO_PLIST,
): Promise<{ appDirectory: string; infoPlistPath: string }> {
  const appContentsDirectory = path.join(temporaryDirectory, `${appName}.app`, "Contents");
  const infoPlistPath = path.join(appContentsDirectory, "Info.plist");
  await mkdir(appContentsDirectory, { recursive: true });
  await writeFile(infoPlistPath, infoPlistContents, "utf8");
  return { appDirectory: path.dirname(appContentsDirectory), infoPlistPath };
}

function parseInfoPlistAsJson(infoPlistPath: string): Record<string, unknown> {
  const plistAsJson = runCommand(["plutil", "-convert", "json", "-o", "-", infoPlistPath]);
  expect(plistAsJson.exitCode).toBe(0);
  return JSON.parse(plistAsJson.stdout.toString()) as Record<string, unknown>;
}

describe("project package registration hook", () => {
  test("registers .gglassproj document type and is idempotent", async () => {
    if (process.platform !== "darwin") {
      return;
    }

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gglassproj-script-test-"));

    try {
      const { infoPlistPath } = await createFixtureAppBundle(temporaryDirectory, "Test");

      const env = {
        ELECTROBUN_OS: "macos",
        ELECTROBUN_BUILD_DIR: temporaryDirectory,
      };

      const firstRun = runCommand([process.execPath, SCRIPT_PATH], env);
      expect(firstRun.exitCode).toBe(0);
      expect(firstRun.stdout.toString()).toContain("updated+validated");

      const secondRun = runCommand([process.execPath, SCRIPT_PATH], env);
      expect(secondRun.exitCode).toBe(0);
      expect(secondRun.stdout.toString()).toContain("already configured");

      const plistContents = JSON.stringify(parseInfoPlistAsJson(infoPlistPath));
      expect(plistContents).toContain(`"UTTypeIdentifier":"${PROJECT_UTI}"`);
      expect(plistContents).toContain(`"LSItemContentTypes":["${PROJECT_UTI}"]`);
      expect(plistContents).toContain('"LSTypeIsPackage":true');
      expect(plistContents).toContain('"CFBundleTypeExtensions":["gglassproj"]');
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test("is a no-op when ELECTROBUN_OS is not macos", async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gglassproj-script-test-"));

    try {
      const { infoPlistPath } = await createFixtureAppBundle(temporaryDirectory, "Noop");
      const originalContents = await readFile(infoPlistPath, "utf8");

      const run = runCommand([process.execPath, SCRIPT_PATH], {
        ELECTROBUN_OS: "linux",
        ELECTROBUN_BUILD_DIR: temporaryDirectory,
      });
      expect(run.exitCode).toBe(0);
      expect(run.stdout.toString()).toBe("");

      const nextContents = await readFile(infoPlistPath, "utf8");
      expect(nextContents).toBe(originalContents);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test("fails fast when build directory is missing for macos run", () => {
    if (process.platform !== "darwin") {
      return;
    }

    const run = runCommand([process.execPath, SCRIPT_PATH], {
      ELECTROBUN_OS: "macos",
      ELECTROBUN_BUILD_DIR: "",
    });

    expect(run.exitCode).not.toBe(0);
    expect(run.stderr.toString()).toContain("ELECTROBUN_BUILD_DIR is not set");
  });

  test("supports explicit wrapper bundle patching path", async () => {
    if (process.platform !== "darwin") {
      return;
    }

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gglassproj-script-test-"));

    try {
      const { appDirectory, infoPlistPath } = await createFixtureAppBundle(
        temporaryDirectory,
        "Wrapper",
      );

      const run = runCommand([process.execPath, SCRIPT_PATH], {
        ELECTROBUN_OS: "macos",
        ELECTROBUN_WRAPPER_BUNDLE_PATH: appDirectory,
      });

      expect(run.exitCode).toBe(0);
      const plistContents = JSON.stringify(parseInfoPlistAsJson(infoPlistPath));
      expect(plistContents).toContain(`"UTTypeIdentifier":"${PROJECT_UTI}"`);
      expect(plistContents).toContain('"CFBundleTypeExtensions":["gglassproj"]');
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  test("replaces malformed legacy project declarations with canonical values", async () => {
    if (process.platform !== "darwin") {
      return;
    }

    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "gglassproj-script-test-"));

    try {
      const malformedInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.okikeSolutions.guerillaglass.desktop</string>
    <key>UTExportedTypeDeclarations</key>
    <array>
        <dict>
            <key>UTTypeIdentifier</key>
            <string>${PROJECT_UTI}</string>
            <key>UTTypeConformsTo</key>
            <array>
                <string>public.data</string>
            </array>
        </dict>
    </array>
    <key>CFBundleDocumentTypes</key>
    <array>
        <dict>
            <key>CFBundleTypeName</key>
            <string>Legacy Project</string>
            <key>CFBundleTypeRole</key>
            <string>Viewer</string>
            <key>CFBundleTypeExtensions</key>
            <array>
                <string>gglassproj</string>
            </array>
        </dict>
    </array>
</dict>
</plist>`;

      const { infoPlistPath } = await createFixtureAppBundle(
        temporaryDirectory,
        "Legacy",
        malformedInfoPlist,
      );

      const run = runCommand([process.execPath, SCRIPT_PATH], {
        ELECTROBUN_OS: "macos",
        ELECTROBUN_BUILD_DIR: temporaryDirectory,
      });

      expect(run.exitCode).toBe(0);
      const plist = parseInfoPlistAsJson(infoPlistPath);
      const documentTypes = (plist.CFBundleDocumentTypes as unknown[]) ?? [];
      const utExportedTypes = (plist.UTExportedTypeDeclarations as unknown[]) ?? [];

      expect(documentTypes.length).toBe(1);
      expect(utExportedTypes.length).toBe(1);

      const normalizedContents = JSON.stringify(plist);
      expect(normalizedContents).toContain(`"UTTypeIdentifier":"${PROJECT_UTI}"`);
      expect(normalizedContents).toContain(
        '"UTTypeConformsTo":["com.apple.package","public.data"]',
      );
      expect(normalizedContents).toContain(
        '"LSItemContentTypes":["com.okikeSolutions.guerillaglass.project"]',
      );
      expect(normalizedContents).toContain('"LSTypeIsPackage":true');
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
