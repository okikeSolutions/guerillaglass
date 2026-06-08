import { writeFileSync } from "node:fs";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/unstable/http";
import { MediaRegistry, layerMediaRegistry } from "../src/bun/media/MediaRegistry";
import { MediaSourceService, layerMediaSourceServiceCore } from "../src/bun/media/service";
import { MediaServerError } from "@shared/errors/desktopErrors";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";

function firstFailure(cause: Cause.Cause<unknown>): unknown {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) ? error.value : Cause.squash(cause);
}

describe("media source service", () => {
  it.effect("fails layer acquisition with a typed error for Unix socket HTTP servers", () =>
    Effect.gen(function* () {
      const layer = layerMediaSourceServiceCore.pipe(
        Layer.provideMerge(layerMediaRegistry),
        Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: "/tmp" })),
        Layer.provide(BunFileSystem.layer),
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

  it("mints loopback media and preview URLs from the scoped HTTP server address", async () => {
    const layer = layerMediaSourceServiceCore.pipe(
      Layer.provideMerge(layerMediaRegistry),
      Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: "/tmp" })),
      Layer.provide(BunFileSystem.layer),
      Layer.provide(
        Layer.succeed(HttpServer.HttpServer, {
          address: { _tag: "TcpAddress", hostname: "127.0.0.1", port: 43210 },
          serve: () => Effect.void,
        }),
      ),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const registry = yield* MediaRegistry;
        const mediaSourceService = yield* MediaSourceService;
        const sourcePath = "/tmp/guerillaglass-media-source-service-test.mov";
        writeFileSync(sourcePath, "fixture-media");
        const mediaURL = yield* mediaSourceService.resolveMediaSourceURL(sourcePath);
        const previewURL = yield* mediaSourceService.resolveCapturePreviewURL(Effect.succeed(null));

        expect(mediaURL.startsWith("http://127.0.0.1:43210/media/")).toBe(true);
        expect(previewURL.startsWith("http://127.0.0.1:43210/media/")).toBe(true);

        const previewToken = decodeURIComponent(
          new URL(previewURL).pathname.split("/").pop() ?? "",
        );
        const entry = yield* registry.resolveToken(previewToken);
        expect(entry._tag).toBe("Some");
      }).pipe(Effect.provide(layer), Effect.scoped),
    );
  });
});
