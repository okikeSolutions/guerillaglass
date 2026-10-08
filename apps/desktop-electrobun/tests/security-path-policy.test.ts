import { layerNoFollowFileIO } from "../src/bun/security/NoFollowFileIO";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { TestClock } from "effect/testing";
import { ConfigProvider, Effect, Layer } from "effect";
import { describe, expect as vitestExpect, test } from "vitest";
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
  Layer.provide(Layer.mergeAll(NodeServices.layer, TestClock.layer())),
);

describe("desktop app config", () => {
  it.effect("uses the fixed Vite desktop dev server port", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.devServerPort).toBe(5173);
    }).pipe(
      Effect.provide(layerAppConfig),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ PORT: "7777" }),
      ),
    ),
  );

  it.effect("GG_DEBUG enables studio and media diagnostics", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.studioDiagnosticsEnabled).toBe(true);
      expect(config.mediaServerDebugLoggingEnabled).toBe(true);
    }).pipe(
      Effect.provide(layerAppConfig),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ GG_DEBUG: "1", PORT: "7777" }),
      ),
    ),
  );
  it.effect("keeps local configuration usable when hosted review URLs are invalid", () =>
    Effect.gen(function* () {
      const config = yield* AppConfig;
      expect(config.reviewConvexUrl).toBeNull();
      expect(config.devServerPort).toBe(5173);
    }).pipe(
      Effect.provide(layerAppConfig),
      Effect.provideService(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          GG_REVIEW_CONVEX_URL: "invalid",
          VITE_CONVEX_URL: "ftp://example.com",
        }),
      ),
    ),
  );
});

describe("desktop navigation rules", () => {
  test("exclude the Vite dev server outside the dev channel", () => {
    vitestExpect(JSON.parse(buildMainViewNavigationRules("stable", 7777))).toEqual([
      "views://mainview/*",
    ]);
    vitestExpect(JSON.parse(buildMainViewNavigationRules("dev", 7777))).toEqual([
      "views://mainview/*",
      "http://localhost:7777/*",
    ]);
  });
});

describe("project/export path grants", () => {
  it.effect("rejects a path selected for the wrong operation kind", () => {
    const projectPath = path.join(tmpdir(), "wrong-kind.gglassproj");
    return Effect.gen(function* () {
      const grants = yield* FileAccessGrants;
      const policy = yield* ProjectExportPathPolicy;
      yield* grants.grantPath("project-open", projectPath);
      const error = yield* Effect.flip(policy.validateProjectSavePath(projectPath));
      expect(error.code).toBe("FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
    }).pipe(Effect.provide(pathPolicyLayer));
  });

  it.effect("rejects an expired grant", () =>
    Effect.gen(function* () {
      const projectPath = path.join(tmpdir(), "expired.gglassproj");
      const grants = yield* FileAccessGrants;
      const policy = yield* ProjectExportPathPolicy;
      yield* grants.grantPath("project-save", projectPath);
      yield* TestClock.adjust("31 minutes");
      const error = yield* Effect.flip(policy.validateProjectSavePath(projectPath));
      expect(error.code).toBe("FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
    }).pipe(Effect.provide(pathPolicyLayer)),
  );

  it.effect("rejects export paths that were not picked through the desktop picker", () => {
    const outputPath = path.join(tmpdir(), "unpicked.mp4");
    return Effect.gen(function* () {
      const policy = yield* ProjectExportPathPolicy;
      const error = yield* Effect.flip(policy.validateExportOutputPath(outputPath));
      expect(error.code).toBe("FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
    }).pipe(Effect.provide(pathPolicyLayer));
  });

  it.effect("allows export files inside a granted export directory", () => {
    const exportRoot = path.join(tmpdir(), "guerillaglass-export-root");
    const outputPath = path.join(exportRoot, "picked.mov");
    return Effect.gen(function* () {
      const grants = yield* FileAccessGrants;
      const policy = yield* ProjectExportPathPolicy;
      yield* grants.grantPath("export-directory", exportRoot);
      const normalized = yield* policy.validateExportOutputPath(outputPath);
      expect(normalized).toBe(path.resolve(outputPath));
    }).pipe(Effect.provide(pathPolicyLayer));
  });

  it.effect("normalizes local file URLs through the Effect Path service", () => {
    const projectPath = path.join(tmpdir(), "local-url.gglassproj");
    const projectURL = pathToFileURL(projectPath);
    projectURL.hostname = "localhost";

    return Effect.gen(function* () {
      const grants = yield* FileAccessGrants;
      const policy = yield* ProjectExportPathPolicy;
      yield* grants.grantPath("project-open", projectPath);
      const normalized = yield* policy.validateProjectOpenPath(projectURL.href);
      expect(normalized).toBe(path.resolve(projectPath));
    }).pipe(Effect.provide(pathPolicyLayer));
  });

  it.effect("rejects non-local file URL hosts", () =>
    Effect.gen(function* () {
      const policy = yield* ProjectExportPathPolicy;
      const error = yield* Effect.flip(
        policy.validateProjectOpenPath("file://remote.example/project.gglassproj"),
      );
      expect(error.code).toBe("LOCAL_FILE_URL_UNSUPPORTED");
    }).pipe(Effect.provide(pathPolicyLayer)),
  );
});

describe("symlink-safe file access", () => {
  it.live("rejects symlink text reads and media snapshots", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const root = yield* Effect.acquireRelease(
          Effect.sync(() => mkdtempSync(path.join(tmpdir(), "gg-security-"))),
          (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
        );
        const targetPath = path.join(root, "target.json");
        const symlinkPath = path.join(root, "link.json");
        const snapshotPath = path.join(root, "snapshot.json");
        yield* Effect.sync(() => {
          writeFileSync(targetPath, "{}");
          symlinkSync(targetPath, symlinkPath);
        });
        const platform = Layer.mergeAll(NodeServices.layer, layerNoFollowFileIO);
        const readError = yield* Effect.flip(
          readAllowedTextFile(symlinkPath, { tempDirectory: root }).pipe(Effect.provide(platform)),
        );
        const copyError = yield* Effect.flip(
          copySafeFileSnapshot(symlinkPath, snapshotPath).pipe(Effect.provide(platform)),
        );
        expect(readError).toMatchObject({ code: "PATH_NOT_FILE" });
        expect(copyError).toMatchObject({ code: "PATH_NOT_FILE" });
      }),
    ),
  );
});
