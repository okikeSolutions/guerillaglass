import { describe, expect, test } from "bun:test";
import { Effect, ManagedRuntime } from "effect";
import { MediaSourceService, makeMediaSourceServiceLive } from "../src/bun/media/service";

describe("media source service", () => {
  test("owns server shutdown through the live layer", async () => {
    let stopped = 0;
    const runtime = ManagedRuntime.make(
      makeMediaSourceServiceLive({
        createServer: () =>
          ({
            resolveMediaSourceURLEffect: (filePath: string) =>
              Effect.succeed(`media://${filePath}`),
            stopEffect: () =>
              Effect.sync(() => {
                stopped += 1;
              }),
          }) as never,
      }),
    );

    try {
      const resolved = await runtime.runPromise(
        Effect.flatMap(MediaSourceService, (mediaSourceService) =>
          mediaSourceService.resolveMediaSourceURL("/tmp/capture.mov"),
        ),
      );

      expect(resolved).toBe("media:///tmp/capture.mov");
    } finally {
      await runtime.dispose();
      expect(stopped).toBe(1);
    }
  });
});
