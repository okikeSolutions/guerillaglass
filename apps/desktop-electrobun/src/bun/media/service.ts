import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Context, Crypto, Effect, FileSystem, Layer, Path } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine-contract/domains/capture";
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
    const crypto = yield* Crypto.Crypto;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tempDirectory = yield* DesktopTempDirectory;
    const origin = yield* originFromAddress(server.address);

    const snapshotMediaFile = (filePath: string) =>
      Effect.gen(function* () {
        const extension = path.extname(filePath).toLowerCase();
        const id = yield* crypto.randomUUIDv4;
        const destinationPath = path.join(tempDirectory.path, `media-${id}${extension}`);
        return yield* Effect.tryPromise(() => copySafeFileSnapshot(filePath, destinationPath));
      }).pipe(
        Effect.mapError(
          (cause) =>
            new MediaServerError({
              code: "MEDIA_FILE_MISSING",
              description: "Unable to create safe media snapshot.",
              cause,
            }),
        ),
      );

    return MediaSourceService.of({
      resolveMediaSourceURL: (filePath) =>
        snapshotMediaFile(filePath).pipe(
          Effect.flatMap((snapshotPath) => registry.registerMediaFile(snapshotPath)),
          Effect.provideService(FileSystem.FileSystem, fs),
          Effect.map((token) => `${origin}/media/${encodeURIComponent(token)}`),
        ),
      resolveCapturePreviewURL: (loadPreviewFrame) =>
        registry.registerCapturePreview(loadPreviewFrame).pipe(
          Effect.map((token) => `${origin}/media/${encodeURIComponent(token)}`),
          Effect.tap((previewURL) =>
            Effect.logInfo("capture preview media URL registered").pipe(
              Effect.annotateLogs({ component: "media-source", previewURL }),
            ),
          ),
        ),
    });
  }),
);

const layerMediaHttpServer = NodeHttpServer.layer(createServer, {
  host: "127.0.0.1",
  port: 0,
  gracefulShutdownTimeout: "2 seconds",
});

const layerServedMediaRoutes = HttpRouter.serve(layerMediaHttpRoutes, {
  disableLogger: true,
  disableListenLog: true,
});

/** Builds the scoped media source layer and owns media HTTP server shutdown. */
export function makeLayerMediaSourceService() {
  const mediaInfrastructureLayer = layerMediaRegistry.pipe(
    Layer.provideMerge(layerMediaHttpServer),
  );
  return Layer.mergeAll(layerMediaSourceServiceCore, layerServedMediaRoutes).pipe(
    Layer.provideMerge(mediaInfrastructureLayer),
  ) as Layer.Layer<MediaSourceService, never, AppConfig | DesktopTempDirectory>;
}

/** Default media source layer used by the desktop app runtime. */
export const layerMediaSourceService = makeLayerMediaSourceService();
