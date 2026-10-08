import { layerNoFollowFileIO } from "../src/bun/security/NoFollowFileIO";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AppConfig, type DesktopAppConfig } from "../src/bun/app/AppConfig";
import { layerMediaSourceService, MediaSourceService } from "../src/bun/media/service";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";

const testAppConfig: DesktopAppConfig = {
  captureBenchmarkEnabled: false,
  studioDiagnosticsEnabled: false,
  mediaServerDebugLoggingEnabled: false,
  devServerPort: 5173,
  nodeEnv: "test",
  electrobunBuild: null,
  allowCustomEnginePath: false,
  enginePath: null,
  engineExpectedSha256: null,
  engineExpectedTeamId: null,
  engineSigningRequirement: null,
  macosCodeSignatureHelperPath: null,
  windowsAuthenticodeHelperPath: null,
  windowsExpectedPublisherSha256Thumbprint: null,
  windowsExpectedPublisherSubject: null,
  windowsAllowOfflineRevocation: false,
  engineRequireCurrentUserOwner: false,
  engineRejectWorldWritable: true,
  tempDirectory: null,
  reviewConvexUrl: null,
};

describe("Node media server integration", () => {
  it.live("starts, serves, and stops the real server composition", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const testDirectory = yield* Effect.acquireRelease(
          Effect.sync(() => mkdtempSync(path.join(os.tmpdir(), "gg-node-media-server-"))),
          (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
        );
        const sourcePath = path.join(testDirectory, "source.mov");
        yield* Effect.sync(() => writeFileSync(sourcePath, "node-media-server-fixture"));
        const layer = layerMediaSourceService.pipe(
          Layer.provide(layerNoFollowFileIO),
          Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: testDirectory })),
          Layer.provide(Layer.succeed(AppConfig, testAppConfig)),
        );

        const mediaURL = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* MediaSourceService;
            const url = yield* service.resolveMediaSourceURL(sourcePath);
            const response = yield* Effect.promise(() =>
              fetch(url, { headers: { connection: "close" } }),
            );
            expect(response.status).toBe(200);
            const body = yield* Effect.promise(() => response.text());
            expect(body).toBe("node-media-server-fixture");
            return url;
          }).pipe(Effect.provide(layer)),
        );
        yield* Effect.promise(() => expect(fetch(mediaURL)).rejects.toThrow());
      }),
    ),
  );
});
