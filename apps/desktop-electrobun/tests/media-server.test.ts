import os from "node:os";
import path from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { describe, expect, test } from "bun:test";
import { MediaServer } from "../src/bun/mediaServer";

async function createTempFile(
  fileName: string,
  contents: string,
): Promise<{
  filePath: string;
  cleanup: () => Promise<void>;
}> {
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

type ServeOptions = Parameters<typeof Bun.serve>[0];
type ServeHandle = ReturnType<typeof Bun.serve>;
type FetchHandler = (request: Request, server: ServeHandle) => Response | Promise<Response>;
type ErrorHandler = (error: Error) => Response | Promise<Response>;

type MockServeConfig = {
  failOnPortZero?: boolean;
  eaddrinuseAttempts?: number;
};

function mockBunServe(config: MockServeConfig = {}) {
  const originalServe = Bun.serve;
  let activeFetchHandler: FetchHandler | null = null;
  let activeErrorHandler: ErrorHandler | null = null;
  let sessionCookie: string | null = null;
  let invocationCount = 0;
  const requestedPorts: number[] = [];
  let remainingEaddrinuseAttempts = config.eaddrinuseAttempts ?? 0;

  (Bun as unknown as { serve: typeof Bun.serve }).serve = ((options: ServeOptions) => {
    invocationCount += 1;
    if (!options.fetch) {
      throw new Error("Missing Bun.serve fetch handler in media server test mock.");
    }
    const requestedPort = typeof options.port === "number" ? options.port : 0;
    requestedPorts.push(requestedPort);

    if (config.failOnPortZero && requestedPort === 0) {
      const error = new Error("Failed to start server. Is port 0 in use?") as Error & {
        code?: string;
      };
      error.code = "EINVAL";
      throw error;
    }

    if (remainingEaddrinuseAttempts > 0 && requestedPort !== 0) {
      remainingEaddrinuseAttempts -= 1;
      const error = new Error("EADDRINUSE: address already in use") as Error & { code?: string };
      error.code = "EADDRINUSE";
      throw error;
    }

    activeFetchHandler = options.fetch as FetchHandler;
    activeErrorHandler = options.error as ErrorHandler;
    const port = 44_000 + invocationCount;
    return {
      port,
      stop: () => {},
    } as ServeHandle;
  }) as typeof Bun.serve;

  return {
    async dispatch(input: string, init?: RequestInit): Promise<Response> {
      if (!activeFetchHandler) {
        throw new Error("Media handler is not registered yet.");
      }
      const headers = new Headers(init?.headers);
      if (sessionCookie && !headers.has("cookie")) {
        headers.set("cookie", sessionCookie);
      }
      const request = new Request(input, { ...init, headers });
      const response = await activeFetchHandler(request, {} as ServeHandle);
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        const [cookiePair] = setCookie.split(";");
        sessionCookie = cookiePair?.trim() || null;
      }
      return response;
    },
    async dispatchWithoutSessionCookie(input: string, init?: RequestInit): Promise<Response> {
      if (!activeFetchHandler) {
        throw new Error("Media handler is not registered yet.");
      }
      const headers = new Headers(init?.headers);
      headers.delete("cookie");
      return await activeFetchHandler(new Request(input, { ...init, headers }), {} as ServeHandle);
    },
    async dispatchUnhandledError(error = new Error("boom")): Promise<Response> {
      if (!activeErrorHandler) {
        throw new Error("Media error handler is not registered yet.");
      }
      return await activeErrorHandler(error);
    },
    get invocationCount() {
      return invocationCount;
    },
    get requestedPorts() {
      return requestedPorts;
    },
    restore() {
      (Bun as unknown as { serve: typeof Bun.serve }).serve = originalServe;
    },
  };
}

function tokenFromResolvedURL(resolvedURL: string): string {
  const parsed = new URL(resolvedURL);
  const encodedToken = parsed.pathname.split("/").pop() ?? "";
  return decodeURIComponent(encodedToken);
}

describe("media server", () => {
  test("serves whole-file and range responses for local media paths", async () => {
    const fixture = await createTempFile("capture.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      expect(resolved.startsWith("http://127.0.0.1:")).toBe(true);
      expect(resolved.includes("/media/")).toBe(true);
      expect(serve.invocationCount).toBe(1);

      const fullResponse = await serve.dispatch(resolved);
      expect(fullResponse.status).toBe(200);
      expect(fullResponse.headers.get("accept-ranges")).toBe("bytes");
      expect(fullResponse.headers.get("content-type")).toBe("video/quicktime");
      expect(fullResponse.headers.get("x-content-type-options")).toBe("nosniff");
      expect(fullResponse.headers.get("cache-control")).toContain("no-store");
      expect(await fullResponse.text()).toBe("0123456789");

      const rangeResponse = await serve.dispatch(resolved, {
        headers: { range: "bytes=2-5" },
      });
      expect(rangeResponse.status).toBe(206);
      expect(rangeResponse.headers.get("content-range")).toBe("bytes 2-5/10");
      expect(await rangeResponse.text()).toBe("2345");
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("supports HEAD and returns 416 for invalid ranges", async () => {
    const fixture = await createTempFile("head.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);

      const headResponse = await serve.dispatch(resolved, { method: "HEAD" });
      expect(headResponse.status).toBe(200);
      expect(headResponse.headers.get("content-length")).toBe("10");
      expect(await headResponse.text()).toBe("");

      const invalidRangeResponse = await serve.dispatch(resolved, {
        headers: { range: "bytes=50-60" },
      });
      expect(invalidRangeResponse.status).toBe(416);
      expect(invalidRangeResponse.headers.get("content-range")).toBe("bytes */10");

      const multiRangeResponse = await serve.dispatch(resolved, {
        headers: { range: "bytes=0-2,4-6" },
      });
      expect(multiRangeResponse.status).toBe(416);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("returns protocol errors for unsupported requests", async () => {
    const fixture = await createTempFile("request.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);

      const parsed = new URL(resolved);
      const trailingSegment = parsed.pathname.split("/").pop() ?? "";
      const badPathResponse = await serve.dispatch(`${parsed.origin}/missing/${trailingSegment}`);
      expect(badPathResponse.status).toBe(404);

      const badTokenResponse = await serve.dispatch(`${parsed.origin}/media/not-a-real-token`);
      expect(badTokenResponse.status).toBe(404);

      const malformedTokenResponse = await serve.dispatch(`${parsed.origin}/media/%E0%A4%A`);
      expect(malformedTokenResponse.status).toBe(400);

      const foreignHostResponse = await serve.dispatch(
        `http://example.com/media/${trailingSegment}`,
      );
      expect(foreignHostResponse.status).toBe(403);

      const postResponse = await serve.dispatch(resolved, { method: "POST" });
      expect(postResponse.status).toBe(405);
      expect(postResponse.headers.get("allow")).toBe("GET, HEAD");
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("rejects unsupported file extensions and missing files", async () => {
    const fixture = await createTempFile("readme.txt", "notes");
    const missingPath = path.join(path.dirname(fixture.filePath), "gone.mov");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      await expect(server.resolveMediaSourceURL(fixture.filePath)).rejects.toThrow(
        "Unsupported media file format.",
      );
      await expect(server.resolveMediaSourceURL(missingPath)).rejects.toThrow(
        "Media file not found.",
      );
      expect(serve.invocationCount).toBe(0);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("prunes oldest tokens once max token count is exceeded", async () => {
    const fixture = await createTempFile("prune.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const firstResolved = await server.resolveMediaSourceURL(fixture.filePath);
      let newestResolved = firstResolved;
      for (let index = 0; index < 520; index += 1) {
        newestResolved = await server.resolveMediaSourceURL(fixture.filePath);
      }

      const firstResponse = await serve.dispatch(firstResolved);
      expect(firstResponse.status).toBe(404);

      const newestResponse = await serve.dispatch(newestResolved);
      expect(newestResponse.status).toBe(200);
      expect(await newestResponse.text()).toBe("0123456789");
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("expires stale token requests", async () => {
    const fixture = await createTempFile("expired.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      const token = tokenFromResolvedURL(resolved);
      const tokenEntry = (
        server as unknown as { tokens: Map<string, { createdAt: number }> }
      ).tokens.get(token);
      expect(tokenEntry).toBeTruthy();
      if (!tokenEntry) {
        throw new Error("Expected media token entry.");
      }
      tokenEntry.createdAt = 0;

      const response = await serve.dispatch(resolved);
      expect(response.status).toBe(404);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("expires idle tokens", async () => {
    const fixture = await createTempFile("idle-expired.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      const token = tokenFromResolvedURL(resolved);
      const tokenEntry = (
        server as unknown as { tokens: Map<string, { lastAccessedAt: number }> }
      ).tokens.get(token);
      expect(tokenEntry).toBeTruthy();
      if (!tokenEntry) {
        throw new Error("Expected media token entry.");
      }
      tokenEntry.lastAccessedAt = 0;

      const response = await serve.dispatch(resolved);
      expect(response.status).toBe(404);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("rejects replay from a client without the bound session cookie", async () => {
    const fixture = await createTempFile("cookie-replay.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();
    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      const firstResponse = await serve.dispatch(resolved);
      expect(firstResponse.status).toBe(200);
      expect(firstResponse.headers.get("set-cookie")).toContain("gg_media_session=");

      const replayResponse = await serve.dispatchWithoutSessionCookie(resolved);
      expect(replayResponse.status).toBe(404);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("rejects non-local and unsupported media source paths", async () => {
    const server = new MediaServer();
    const serve = mockBunServe();
    try {
      await expect(server.resolveMediaSourceURL("https://example.com/video.mov")).rejects.toThrow();
      await expect(server.resolveMediaSourceURL("file://example.com/video.mov")).rejects.toThrow();
      await expect(server.resolveMediaSourceURL("recordings/session.mp4")).rejects.toThrow();
      expect(serve.invocationCount).toBe(0);
    } finally {
      serve.restore();
      server.stop();
    }
  });

  test("falls back to reserved loopback port when port zero binding is unsupported", async () => {
    const fixture = await createTempFile("port-zero-fallback.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe({ failOnPortZero: true });

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      expect(resolved.startsWith("http://127.0.0.1:")).toBe(true);
      expect(serve.requestedPorts[0]).toBe(0);
      expect(serve.requestedPorts.some((port) => port > 0)).toBe(true);
      expect(serve.invocationCount).toBe(2);
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("retries media server bind on EADDRINUSE collisions", async () => {
    const fixture = await createTempFile("port-collision-retry.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe({ failOnPortZero: true, eaddrinuseAttempts: 2 });

    try {
      const resolved = await server.resolveMediaSourceURL(fixture.filePath);
      expect(resolved.startsWith("http://127.0.0.1:")).toBe(true);
      expect(serve.requestedPorts[0]).toBe(0);
      expect(serve.invocationCount).toBe(4);
      const response = await serve.dispatch(resolved);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("0123456789");
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });

  test("returns a generic 500 response from Bun.serve error handler", async () => {
    const fixture = await createTempFile("error-handler.mov", "0123456789");
    const server = new MediaServer();
    const serve = mockBunServe();

    try {
      await server.resolveMediaSourceURL(fixture.filePath);
      const response = await serve.dispatchUnhandledError(new Error("secret details"));
      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Internal server error");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toContain("no-store");
    } finally {
      serve.restore();
      server.stop();
      await fixture.cleanup();
    }
  });
});
