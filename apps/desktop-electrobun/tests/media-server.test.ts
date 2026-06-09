import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "vitest";
import { Cause, Effect, Layer, Option } from "effect";
import { HttpPlatform, HttpRouter } from "effect/unstable/http";
import { MediaRegistry, makeMediaRegistryService } from "../src/bun/media/MediaRegistry";
import { layerMediaHttpRoutes } from "../src/bun/media/MediaHttpRoutes";
import { MediaServerError } from "@shared/errors/desktopErrors";

const livePreviewBytes = Buffer.from("preview-frame", "utf8");
const livePreviewBase64 = livePreviewBytes.toString("base64");

async function createTempFile(fileName: string, contents: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "gg-media-server-"));
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, contents);
  return {
    filePath,
    cleanup: async () => {
      await rm(directory, { recursive: true, force: true });
    },
  };
}

function mediaAppLayer(registry: MediaRegistry["Service"]) {
  return Layer.mergeAll(
    layerMediaHttpRoutes,
    Layer.succeed(MediaRegistry, registry),
    HttpPlatform.layer.pipe(Layer.provide(BunFileSystem.layer)),
    BunFileSystem.layer,
  );
}

const makeHarness = Effect.gen(function* () {
  const registry = yield* makeMediaRegistryService;
  const webHandler = HttpRouter.toWebHandler(mediaAppLayer(registry), { disableLogger: true });
  return { registry, handler: webHandler.handler, dispose: webHandler.dispose };
});

function mediaURL(token: string): string {
  return `http://127.0.0.1/media/${encodeURIComponent(token)}`;
}

type WebHandler = (request: Request, context: never) => Promise<Response>;

function dispatch(
  handler: WebHandler,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return handler(new Request(input, init), undefined as never);
}

function firstFailure(cause: Cause.Cause<unknown>): unknown {
  const error = Cause.findErrorOption(cause);
  return Option.isSome(error) ? error.value : Cause.squash(cause);
}

function effectTest(name: string, effect: () => Effect.Effect<void, unknown, unknown>): void {
  it(name, async () => {
    await Effect.runPromise(
      effect().pipe(Effect.provide(BunFileSystem.layer)) as Effect.Effect<void, unknown, never>,
    );
  });
}

describe("media HTTP routes", () => {
  effectTest("serves whole-file and range responses for local media paths", () =>
    Effect.gen(function* () {
      const fixture = yield* Effect.promise(() => createTempFile("capture.mov", "0123456789"));
      try {
        const { registry, handler } = yield* makeHarness;
        const token = yield* registry.registerMediaFile(fixture.filePath);
        const resolved = mediaURL(token);

        const fullResponse = yield* Effect.promise(() => dispatch(handler, resolved));
        expect(fullResponse.status).toBe(200);
        expect(fullResponse.headers.get("accept-ranges")).toBe("bytes");
        expect(fullResponse.headers.get("content-type")).toBe("video/quicktime");
        expect(fullResponse.headers.get("x-content-type-options")).toBe("nosniff");
        expect(fullResponse.headers.get("cache-control")).toContain("no-store");
        expect(yield* Effect.promise(() => fullResponse.text())).toBe("0123456789");

        const rangeResponse = yield* Effect.promise(() =>
          dispatch(handler, resolved, { headers: { range: "bytes=2-5" } }),
        );
        expect(rangeResponse.status).toBe(206);
        expect(rangeResponse.headers.get("content-range")).toBe("bytes 2-5/10");
        expect(yield* Effect.promise(() => rangeResponse.text())).toBe("2345");
      } finally {
        yield* Effect.promise(() => fixture.cleanup());
      }
    }),
  );

  effectTest("supports HEAD, serves first segment for multi-range, and returns 416", () =>
    Effect.gen(function* () {
      const fixture = yield* Effect.promise(() => createTempFile("head.mov", "0123456789"));
      try {
        const { registry, handler } = yield* makeHarness;
        const token = yield* registry.registerMediaFile(fixture.filePath);
        const resolved = mediaURL(token);

        const headResponse = yield* Effect.promise(() =>
          dispatch(handler, resolved, { method: "HEAD" }),
        );
        expect(headResponse.status).toBe(200);
        expect(headResponse.headers.get("content-length")).toBe("10");
        expect(yield* Effect.promise(() => headResponse.text())).toBe("");

        const invalidRangeResponse = yield* Effect.promise(() =>
          dispatch(handler, resolved, { headers: { range: "bytes=50-60" } }),
        );
        expect(invalidRangeResponse.status).toBe(416);
        expect(invalidRangeResponse.headers.get("content-range")).toBe("bytes */10");

        const multiRangeResponse = yield* Effect.promise(() =>
          dispatch(handler, resolved, { headers: { range: "bytes=0-2,4-6" } }),
        );
        expect(multiRangeResponse.status).toBe(206);
        expect(multiRangeResponse.headers.get("content-range")).toBe("bytes 0-2/10");
        expect(yield* Effect.promise(() => multiRangeResponse.text())).toBe("012");
      } finally {
        yield* Effect.promise(() => fixture.cleanup());
      }
    }),
  );

  effectTest("rejects unsupported and missing media paths before minting tokens", () =>
    Effect.gen(function* () {
      const { registry } = yield* makeHarness;
      const unsupported = yield* Effect.exit(
        registry.registerMediaFile(path.join(os.tmpdir(), "capture.txt")),
      );
      expect(unsupported._tag).toBe("Failure");
      if (unsupported._tag === "Failure") {
        const error = firstFailure(unsupported.cause);
        expect(error).toBeInstanceOf(MediaServerError);
        expect((error as MediaServerError).code).toBe("MEDIA_TYPE_UNSUPPORTED");
      }

      const missing = yield* Effect.exit(
        registry.registerMediaFile(path.join(os.tmpdir(), "missing.mov")),
      );
      expect(missing._tag).toBe("Failure");
      if (missing._tag === "Failure") {
        const error = firstFailure(missing.cause);
        expect(error).toBeInstanceOf(MediaServerError);
        expect((error as MediaServerError).code).toBe("MEDIA_FILE_MISSING");
      }
    }),
  );

  effectTest("returns 404 when a media file is deleted after token minting", () =>
    Effect.gen(function* () {
      const fixture = yield* Effect.promise(() => createTempFile("deleted.mov", "gone"));
      try {
        const { registry, handler } = yield* makeHarness;
        const token = yield* registry.registerMediaFile(fixture.filePath);
        yield* Effect.promise(() => rm(fixture.filePath, { force: true }));

        const response = yield* Effect.promise(() => dispatch(handler, mediaURL(token)));
        expect(response.status).toBe(404);
        expect(yield* Effect.promise(() => response.text())).toBe("Not found");
      } finally {
        yield* Effect.promise(() => fixture.cleanup());
      }
    }),
  );

  effectTest("returns 404 for unknown, invalid, expired, and non-loopback tokens", () =>
    Effect.gen(function* () {
      const fixture = yield* Effect.promise(() => createTempFile("secure.mp4", "secure"));
      try {
        const { registry, handler } = yield* makeHarness;
        const token = yield* registry.registerMediaFile(fixture.filePath);

        const unknownResponse = yield* Effect.promise(() =>
          dispatch(handler, mediaURL("00000000-0000-4000-8000-000000000000")),
        );
        expect(unknownResponse.status).toBe(404);

        const invalidResponse = yield* Effect.promise(() =>
          dispatch(handler, "http://127.0.0.1/media/not-a-token"),
        );
        expect(invalidResponse.status).toBe(404);

        const forbiddenResponse = yield* Effect.promise(() =>
          dispatch(handler, `http://example.com/media/${encodeURIComponent(token)}`),
        );
        expect(forbiddenResponse.status).toBe(403);
      } finally {
        yield* Effect.promise(() => fixture.cleanup());
      }
    }),
  );

  effectTest("serves live preview frames and cached fallback frames", () =>
    Effect.gen(function* () {
      const { registry, handler } = yield* makeHarness;
      let calls = 0;
      const token = yield* registry.registerCapturePreview(
        Effect.sync(() => {
          calls += 1;
          return calls === 1 ? { frame: { frameId: 1, bytesBase64: livePreviewBase64 } } : {};
        }),
      );
      const resolved = mediaURL(token);

      const firstResponse = yield* Effect.promise(() => dispatch(handler, resolved));
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get("content-type")).toBe("image/jpeg");
      expect(Buffer.from(yield* Effect.promise(() => firstResponse.arrayBuffer()))).toEqual(
        livePreviewBytes,
      );

      const cachedResponse = yield* Effect.promise(() => dispatch(handler, resolved));
      expect(cachedResponse.status).toBe(200);
      expect(Buffer.from(yield* Effect.promise(() => cachedResponse.arrayBuffer()))).toEqual(
        livePreviewBytes,
      );
    }),
  );

  effectTest("returns 404 when live preview has no frame and no cache", () =>
    Effect.gen(function* () {
      const { registry, handler } = yield* makeHarness;
      const token = yield* registry.registerCapturePreview(Effect.succeed({}));
      const response = yield* Effect.promise(() => dispatch(handler, mediaURL(token)));
      expect(response.status).toBe(404);
    }),
  );

  effectTest("returns health response", () =>
    Effect.gen(function* () {
      const { handler } = yield* makeHarness;
      const response = yield* Effect.promise(() => dispatch(handler, "http://127.0.0.1/health"));
      expect(response.status).toBe(200);
      expect(yield* Effect.promise(() => response.text())).toBe("ok");
    }),
  );
});
