import { Context, Effect, Layer } from "effect";
import type { CapturePreviewFrameResult } from "@guerillaglass/engine/protocol/domains/capture";
import { MediaServer } from "./server";

type MediaServerLike = Pick<
  MediaServer,
  "resolveMediaSourceURLEffect" | "resolveCapturePreviewURLEffect" | "stopEffect"
>;

/** Effect service contract for resolving signed media source URLs. */
export type MediaSourceServiceType = {
  resolveMediaSourceURL: (
    filePath: string,
  ) => ReturnType<MediaServerLike["resolveMediaSourceURLEffect"]>;
  resolveCapturePreviewURL: (
    loadPreviewFrame: Effect.Effect<CapturePreviewFrameResult, unknown>,
  ) => ReturnType<MediaServerLike["resolveCapturePreviewURLEffect"]>;
};

/** Effect service tag for media URL resolution in the Bun host. */
export class MediaSourceService extends Context.Service<
  MediaSourceService,
  MediaSourceServiceType
>()("@guerillaglass/desktop/MediaSourceService") {}

/** Wraps a media server instance in the Effect media source service interface. */
export function makeMediaSourceService(server: MediaServerLike): MediaSourceServiceType {
  return {
    resolveMediaSourceURL: (filePath) => server.resolveMediaSourceURLEffect(filePath),
    resolveCapturePreviewURL: (loadPreviewFrame) =>
      server.resolveCapturePreviewURLEffect(loadPreviewFrame),
  };
}

/** Builds the scoped media source layer and owns media server shutdown. */
export function makeLayerMediaSourceService(options?: { createServer?: () => MediaServerLike }) {
  const createServer = options?.createServer ?? (() => new MediaServer());
  return Layer.effect(
    MediaSourceService,
    Effect.acquireRelease(Effect.sync(createServer), (server) =>
      Effect.catch(server.stopEffect(), (error) =>
        Effect.logWarning("Media source service shutdown failed", error),
      ),
    ).pipe(Effect.map(makeMediaSourceService)),
  );
}

/** Default media source layer used by the desktop app runtime. */
export const layerMediaSourceService = makeLayerMediaSourceService();
