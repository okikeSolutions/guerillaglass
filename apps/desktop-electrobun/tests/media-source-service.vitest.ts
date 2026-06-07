import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { MediaSourceService, makeLayerMediaSourceService } from "../src/bun/media/service";

describe("media source service", () => {
  it.effect("owns server shutdown through the live layer", () =>
    Effect.gen(function* () {
      let stopped = 0;

      const layer = makeLayerMediaSourceService({
        createServer: () =>
          ({
            resolveMediaSourceURLEffect: (filePath: string) => Effect.succeed(`media://${filePath}`),
            resolveCapturePreviewURLEffect: () => Effect.succeed("media://capture-preview"),
            stopEffect: () =>
              Effect.sync(() => {
                stopped += 1;
              }),
          }) as never,
      });

      yield* Effect.gen(function* () {
        const mediaSourceService = yield* MediaSourceService;
        const resolved = yield* mediaSourceService.resolveMediaSourceURL("/tmp/capture.mov");
        const previewURL = yield* mediaSourceService.resolveCapturePreviewURL(Effect.succeed(null));

        expect(resolved).toBe("media:///tmp/capture.mov");
        expect(previewURL).toBe("media://capture-preview");
      }).pipe(Effect.provide(layer), Effect.scoped);

      expect(stopped).toBe(1);
    }),
  );
});
