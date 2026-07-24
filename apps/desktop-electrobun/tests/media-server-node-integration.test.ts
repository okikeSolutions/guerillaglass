import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { Effect, Layer } from "effect";
import { AppConfig, type DesktopAppConfig } from "../src/bun/app/AppConfig";
import { MediaSourceService, makeLayerMediaSourceService } from "../src/bun/media/service";
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
  test("starts, serves, and stops the real server composition", async () => {
    const testDirectory = mkdtempSync(path.join(os.tmpdir(), "gg-node-media-server-"));
    const sourcePath = path.join(testDirectory, "source.mov");
    writeFileSync(sourcePath, "node-media-server-fixture");
    const layer = makeLayerMediaSourceService().pipe(
      Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: testDirectory })),
      Layer.provide(Layer.succeed(AppConfig, testAppConfig)),
    );

    try {
      const mediaURL = await Effect.runPromise(
        Effect.scoped(
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
        ),
      );

      await expect(fetch(mediaURL)).rejects.toThrow();
    } finally {
      rmSync(testDirectory, { recursive: true, force: true });
    }
  }, 10_000);
});
