import { Context, Effect, Layer } from "effect";
import { MediaServer } from "./server";

type MediaServerLike = Pick<MediaServer, "resolveMediaSourceURLEffect" | "stopEffect">;

/** Effect service contract for resolving signed media source URLs. */
export type MediaSourceServiceType = {
  resolveMediaSourceURL: (
    filePath: string,
  ) => ReturnType<MediaServerLike["resolveMediaSourceURLEffect"]>;
};

/** Effect service tag for media URL resolution in the Bun host. */
export class MediaSourceService extends Context.Tag("@guerillaglass/desktop/MediaSourceService")<
  MediaSourceService,
  MediaSourceServiceType
>() {}

/** Wraps a media server instance in the Effect media source service interface. */
export function makeMediaSourceService(server: MediaServerLike): MediaSourceServiceType {
  return {
    resolveMediaSourceURL: (filePath) => server.resolveMediaSourceURLEffect(filePath),
  };
}

/** Builds the scoped live media source layer and owns media server shutdown. */
export function makeMediaSourceServiceLive(options?: { createServer?: () => MediaServerLike }) {
  const createServer = options?.createServer ?? (() => new MediaServer());
  return Layer.scoped(
    MediaSourceService,
    Effect.acquireRelease(Effect.sync(createServer), (server) =>
      Effect.catchAll(server.stopEffect(), (error) =>
        Effect.logWarning("Media source service shutdown failed", error),
      ),
    ).pipe(Effect.map(makeMediaSourceService)),
  );
}

/** Default live media source layer used by the desktop Bun host runtime. */
export const MediaSourceServiceLive = makeMediaSourceServiceLive();
