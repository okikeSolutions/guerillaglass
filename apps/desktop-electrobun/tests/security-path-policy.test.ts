import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ConfigProvider, Effect, Layer } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppConfig, layerAppConfig } from "../src/bun/app/AppConfig";
import { layerFileAccessGrants, FileAccessGrants } from "../src/bun/security/FileAccessGrants";
import {
  layerProjectExportPathPolicy,
  ProjectExportPathPolicy,
} from "../src/bun/security/ProjectExportPathPolicy";
import { copySafeFileSnapshot, readAllowedTextFile } from "../src/bun/security/fileAccess";
import { buildMainViewNavigationRules } from "../src/bun/security/DesktopNavigationPolicy";

const pathPolicyLayer = layerProjectExportPathPolicy.pipe(
  Layer.provideMerge(layerFileAccessGrants),
  Layer.provide(NodeServices.layer),
);

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("desktop app config", () => {
  test("uses the fixed Vite desktop dev server port", async () => {
    const config = await Effect.runPromise(
      AppConfig.pipe(
        Effect.provide(layerAppConfig),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ PORT: "7777" }),
        ),
      ),
    );

    expect(config.devServerPort).toBe(5173);
  });

  test("GG_DEBUG enables studio and media diagnostics", async () => {
    const config = await Effect.runPromise(
      AppConfig.pipe(
        Effect.provide(layerAppConfig),
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({ GG_DEBUG: "1", PORT: "7777" }),
        ),
      ),
    );

    expect(config.studioDiagnosticsEnabled).toBe(true);
    expect(config.mediaServerDebugLoggingEnabled).toBe(true);
  });
});

describe("desktop navigation rules", () => {
  test("exclude the Vite dev server outside the dev channel", () => {
    expect(JSON.parse(buildMainViewNavigationRules("stable", 7777))).toEqual([
      "views://mainview/*",
    ]);
    expect(JSON.parse(buildMainViewNavigationRules("dev", 7777))).toEqual([
      "views://mainview/*",
      "http://localhost:7777/*",
    ]);
  });
});

describe("project/export path grants", () => {
  test("rejects a path selected for the wrong operation kind", async () => {
    const projectPath = path.join(tmpdir(), "wrong-kind.gglassproj");

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const grants = yield* FileAccessGrants;
        const policy = yield* ProjectExportPathPolicy;
        yield* grants.grantPath("project-open", projectPath);
        return yield* Effect.exit(policy.validateProjectSavePath(projectPath));
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("Access denied");
    }
  });

  test("rejects an expired grant", async () => {
    const projectPath = path.join(tmpdir(), "expired.gglassproj");
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(31 * 60 * 1000);

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const grants = yield* FileAccessGrants;
        const policy = yield* ProjectExportPathPolicy;
        yield* grants.grantPath("project-save", projectPath);
        return yield* Effect.exit(policy.validateProjectSavePath(projectPath));
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(exit._tag).toBe("Failure");
  });

  test("rejects export paths that were not picked through the desktop picker", async () => {
    const outputPath = path.join(tmpdir(), "unpicked.mp4");

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const policy = yield* ProjectExportPathPolicy;
        return yield* Effect.exit(policy.validateExportOutputPath(outputPath));
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(exit._tag).toBe("Failure");
  });

  test("allows export files inside a granted export directory", async () => {
    const exportRoot = path.join(tmpdir(), "guerillaglass-export-root");
    const outputPath = path.join(exportRoot, "picked.mov");

    const normalized = await Effect.runPromise(
      Effect.gen(function* () {
        const grants = yield* FileAccessGrants;
        const policy = yield* ProjectExportPathPolicy;
        yield* grants.grantPath("export-directory", exportRoot);
        return yield* policy.validateExportOutputPath(outputPath);
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(normalized).toBe(path.resolve(outputPath));
  });

  test("normalizes local file URLs through the Effect Path service", async () => {
    const projectPath = path.join(tmpdir(), "local-url.gglassproj");
    const projectURL = pathToFileURL(projectPath);
    projectURL.hostname = "localhost";

    const normalized = await Effect.runPromise(
      Effect.gen(function* () {
        const grants = yield* FileAccessGrants;
        const policy = yield* ProjectExportPathPolicy;
        yield* grants.grantPath("project-open", projectPath);
        return yield* policy.validateProjectOpenPath(projectURL.href);
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(normalized).toBe(path.resolve(projectPath));
  });

  test("rejects non-local file URL hosts", async () => {
    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const policy = yield* ProjectExportPathPolicy;
        return yield* Effect.exit(
          policy.validateProjectOpenPath("file://remote.example/project.gglassproj"),
        );
      }).pipe(Effect.provide(pathPolicyLayer)),
    );

    expect(exit._tag).toBe("Failure");
    if (exit._tag === "Failure") {
      expect(String(exit.cause)).toContain("Only local file URLs are supported");
    }
  });
});

describe("symlink-safe file access", () => {
  test("rejects symlink text reads and media snapshots", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "gg-security-"));
    try {
      const targetPath = path.join(root, "target.json");
      const symlinkPath = path.join(root, "link.json");
      const snapshotPath = path.join(root, "snapshot.json");
      writeFileSync(targetPath, "{}");
      symlinkSync(targetPath, symlinkPath);

      await expect(readAllowedTextFile(symlinkPath, { tempDirectory: root })).rejects.toBeTruthy();
      await expect(copySafeFileSnapshot(symlinkPath, snapshotPath)).rejects.toBeTruthy();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
