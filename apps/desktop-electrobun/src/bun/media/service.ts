import path from "node:path";
import { randomUUID } from "node:crypto";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Context, Effect, FileSystem, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine/protocol/domains/capture";
import { AppConfig } from "../app/AppConfig";
import { DesktopTempDirectory } from "../security/DesktopTempDirectory";
import { copySafeFileSnapshot } from "../security/fileAccess";
import { MediaServerError } from "../../shared/errors/desktopErrors";
import { layerMediaHttpRoutes } from "./MediaHttpRoutes";
import { MediaRegistry, layerMediaRegistry } from "./MediaRegistry";

/** Effect service contract for resolving signed media source URLs. */
export type MediaSourceServiceType = {
  resolveMediaSourceURL: (filePath: string) => Effect.Effect<string, MediaServerError>;
  resolveCapturePreviewURL: (
    loadPreviewFrame: Effect.Effect<CapturePreviewFrameResult, unknown>,
  ) => Effect.Effect<string, MediaServerError>;
};

/** Effect service tag for media URL resolution in the Bun host. */
export class MediaSourceService extends Context.Service<
  MediaSourceService,
  MediaSourceServiceType
>()("@guerillaglass/desktop/MediaSourceService") {}

function originFromAddress(address: HttpServer.Address): Effect.Effect<string, MediaServerError> {
  if (address._tag === "UnixAddress") {
    return Effect.fail(
      new MediaServerError({
        code: "MEDIA_SERVER_BIND_FAILED",
        description: "Media server must listen on a loopback TCP address.",
      }),
    );
  }
  const hostname =
    address.hostname === "0.0.0.0" || address.hostname === "::" ? "127.0.0.1" : address.hostname;
  return Effect.succeed(`http://${hostname}:${address.port}`);
}

export const layerMediaSourceServiceCore = Layer.effect(
  MediaSourceService,
  Effect.gen(function* () {
    const registry = yield* MediaRegistry;
    const server = yield* HttpServer.HttpServer;
    const fs = yield* FileSystem.FileSystem;
    const tempDirectory = yield* DesktopTempDirectory;
    const origin = yield* originFromAddress(server.address);

    const snapshotMediaFile = (filePath: string) =>
      Effect.tryPromise({
        try: () => {
          const extension = path.extname(filePath).toLowerCase();
          const destinationPath = path.join(
            tempDirectory.path,
            `media-${randomUUID()}${extension}`,
          );
          return copySafeFileSnapshot(filePath, destinationPath);
        },
        catch: (cause) =>
          new MediaServerError({
            code: "MEDIA_FILE_MISSING",
            description: "Unable to create safe media snapshot.",
            cause,
          }),
      });

    return MediaSourceService.of({
      resolveMediaSourceURL: (filePath) =>
        snapshotMediaFile(filePath).pipe(
          Effect.flatMap((snapshotPath) => registry.registerMediaFile(snapshotPath)),
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.map((token) => `${origin}/media/${encodeURIComponent(token)}`),
        ),
      resolveCapturePreviewURL: (loadPreviewFrame) =>
        registry
          .registerCapturePreview(loadPreviewFrame)
          .pipe(Effect.map((token) => `${origin}/media/${encodeURIComponent(token)}`)),
    });
  }),
);

const layerMediaHttpServer = BunHttpServer.layer({
  hostname: "127.0.0.1",
  port: 0,
  gracefulShutdownTimeout: "2 seconds",
});

const layerServedMediaRoutes = HttpRouter.serve(layerMediaHttpRoutes, {
  disableLogger: true,
  disableListenLog: true,
});

/** Builds the scoped media source layer and owns media HTTP server shutdown. */
export function makeLayerMediaSourceService() {
  return Layer.mergeAll(layerMediaSourceServiceCore, layerServedMediaRoutes).pipe(
    Layer.provideMerge(Layer.mergeAll(layerMediaRegistry, layerMediaHttpServer)),
  ) as Layer.Layer<MediaSourceService, never, AppConfig | DesktopTempDirectory>;
}

/** Default media source layer used by the desktop app runtime. */
export const layerMediaSourceService = makeLayerMediaSourceService();
