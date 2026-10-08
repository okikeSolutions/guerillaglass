import { layerNoFollowFileIO } from "../src/bun/security/NoFollowFileIO";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Layer, Option } from "effect";
import { HttpServer } from "effect/http";
import { NetAddress } from "effect/net";
import { MediaRegistry, layerMediaRegistry } from "../src/bun/media/MediaRegistry";
import { MediaSourceService, layerMediaSourceServiceCore } from "../src/bun/media/service";
import { MediaServerError } from "@shared/errors/desktopErrors";
import { DesktopTempDirectory } from "../src/bun/security/DesktopTempDirectory";

function firstFailure(cause: Cause.Cause<unknown>): unknown {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) ? error.value : Cause.squash(cause);
}

describe("media source service", () => {
  it.effect("fails layer acquisition with a typed error for non-TCP HTTP servers", () =>
    Effect.gen(function* () {
      const layer = layerMediaSourceServiceCore.pipe(
        Layer.provideMerge(layerMediaRegistry),
        Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: os.tmpdir() })),
        Layer.provide(NodeServices.layer),
        Layer.provide(layerNoFollowFileIO),
        Layer.provide(
          Layer.succeed(HttpServer.HttpServer, {
            address: NetAddress.unixPathAddress("/tmp/guerillaglass-media.sock"),
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
        if (!(error instanceof MediaServerError)) {
          throw error;
        }
        expect(error.code).toBe("MEDIA_SERVER_BIND_FAILED");
      }
    }),
  );

  it.live("mints media and preview URLs from IPv4 and IPv6 loopback bindings", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const testDirectory = yield* Effect.acquireRelease(
          Effect.sync(() => mkdtempSync(path.join(os.tmpdir(), "gg-media-source-service-"))),
          (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
        );
        const sourcePath = path.join(testDirectory, "guerillaglass-media-source-service-test.mov");
        yield* Effect.sync(() => writeFileSync(sourcePath, "fixture-media"));

        for (const { address, origin } of [
          { address: "127.0.0.1:43210", origin: "http://127.0.0.1:43210" },
          { address: "[::1]:43210", origin: "http://[::1]:43210" },
        ]) {
          const layer = layerMediaSourceServiceCore.pipe(
            Layer.provideMerge(layerMediaRegistry),
            Layer.provideMerge(Layer.succeed(DesktopTempDirectory, { path: testDirectory })),
            Layer.provide(NodeServices.layer),
            Layer.provide(layerNoFollowFileIO),
            Layer.provide(
              Layer.succeed(HttpServer.HttpServer, {
                address: NetAddress.inetAddressFromStringUnsafe(address),
                serve: () => Effect.void,
              }),
            ),
          );
          const services = yield* Effect.gen(function* () {
            return {
              registry: yield* MediaRegistry,
              mediaSourceService: yield* MediaSourceService,
            };
          }).pipe(Effect.provide(layer));
          const { registry, mediaSourceService } = services;
          const mediaURL = yield* mediaSourceService.resolveMediaSourceURL(sourcePath);
          const previewURL = yield* mediaSourceService.resolveCapturePreviewURL(() =>
            Effect.succeed({}),
          );

          expect(new URL(mediaURL).origin).toBe(origin);
          expect(new URL(previewURL).origin).toBe(origin);

          const previewToken = decodeURIComponent(
            new URL(previewURL).pathname.split("/").pop() ?? "",
          );
          const entry = yield* registry.resolveToken(previewToken);
          expect(Option.isSome(entry)).toBe(true);
        }
      }),
    ),
  );
});
