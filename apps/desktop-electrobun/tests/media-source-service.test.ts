import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/unstable/http";
import { MediaRegistry, layerMediaRegistry } from "../src/bun/media/MediaRegistry";
import {
  MediaSourceService,
  layerMediaSourceServiceCore,
  makeLayerMediaSourceService,
} from "../src/bun/media/service";
import { MediaServerError } from "@shared/errors/desktopErrors";
import { AppConfig, type DesktopAppConfig } from "../src/bun/app/AppConfig";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";

function firstFailure(cause: Cause.Cause<unknown>): unknown {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) ? error.value : Cause.squash(cause);
}

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

describe("media source service", () => {
  it.effect("fails layer acquisition with a typed error for non-TCP HTTP servers", () =>
    Effect.gen(function* () {
      const layer = layerMediaSourceServiceCore.pipe(
        Layer.provideMerge(layerMediaRegistry),
        Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: os.tmpdir() })),
        Layer.provide(NodeServices.layer),
        Layer.provide(
          Layer.succeed(HttpServer.HttpServer, {
            address: { _tag: "UnixAddress", path: "/tmp/guerillaglass-media.sock" },
            serve: () => Effect.void,
          }),
        ),
      );

      const exit = yield* Effect.exit(
        MediaSourceService.pipe(Effect.provide(layer), Effect.scoped),
      );

      expect(exit._tag).toBe("Failure");
      if (exit._tag === "Failure") {
        const error = firstFailure(exit.cause);
        expect(error).toBeInstanceOf(MediaServerError);
        expect((error as MediaServerError).code).toBe("MEDIA_SERVER_BIND_FAILED");
      }
    }),
  );

  it("starts, serves, and stops the real Node media server composition", async () => {
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
            const response = yield* Effect.promise(() => fetch(url));
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

  it("mints loopback media and preview URLs from the scoped HTTP server address", async () => {
    const layer = layerMediaSourceServiceCore.pipe(
      Layer.provideMerge(layerMediaRegistry),
      Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: os.tmpdir() })),
      Layer.provide(NodeServices.layer),
      Layer.provide(
        Layer.succeed(HttpServer.HttpServer, {
          address: { _tag: "TcpAddress", hostname: "127.0.0.1", port: 43_210 },
          serve: () => Effect.void,
        }),
      ),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* MediaRegistry;
        const mediaSourceService = yield* MediaSourceService;
        const testDirectory = mkdtempSync(path.join(os.tmpdir(), "gg-media-source-service-"));
        try {
          const sourcePath = path.join(
            testDirectory,
            "guerillaglass-media-source-service-test.mov",
          );
          writeFileSync(sourcePath, "fixture-media");
          const mediaURL = yield* mediaSourceService.resolveMediaSourceURL(sourcePath);
          const previewURL = yield* mediaSourceService.resolveCapturePreviewURL(Effect.succeed({}));

          expect(mediaURL.startsWith("http://127.0.0.1:43210/media/")).toBe(true);
          expect(previewURL.startsWith("http://127.0.0.1:43210/media/")).toBe(true);

          const previewToken = decodeURIComponent(
            new URL(previewURL).pathname.split("/").pop() ?? "",
          );
          const entry = yield* registry.resolveToken(previewToken);
          expect(entry._tag).toBe("Some");
        } finally {
          rmSync(testDirectory, { recursive: true, force: true });
        }
      }).pipe(Effect.provide(layer), Effect.scoped),
    );
  });
});
