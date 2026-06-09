import { describe, expect, test } from "vitest";
import { engineHttpBaseUrl, isLoopbackReadyHost, parseEngineHttpReadyLine } from "../src/process/readiness";

describe("engine HTTP readiness", () => {
  test("accepts v2 HTTP readiness on loopback hosts", () => {
    expect(parseEngineHttpReadyLine(JSON.stringify({
      type: "guerillaglass.engine.http.ready",
      host: "127.0.0.1",
      port: 49152,
    }))).toEqual({ host: "127.0.0.1", port: 49152 });

    expect(isLoopbackReadyHost("localhost")).toBe(true);
    expect(isLoopbackReadyHost("::1")).toBe(true);
    expect(isLoopbackReadyHost("[::1]")).toBe(true);
  });

  test("rejects non-HTTP readiness and non-loopback hosts", () => {
    expect(parseEngineHttpReadyLine(JSON.stringify({
      type: "guerillaglass.engine.ready",
      host: "127.0.0.1",
      port: 49152,
    }))).toBeUndefined();

    expect(parseEngineHttpReadyLine(JSON.stringify({
      type: "guerillaglass.engine.http.ready",
      host: "0.0.0.0",
      port: 49152,
    }))).toBeUndefined();

    expect(parseEngineHttpReadyLine(JSON.stringify({
      type: "guerillaglass.engine.http.ready",
      host: "127.0.0.1",
      port: 0,
    }))).toBeUndefined();
  });

  test("builds local HTTP base URLs from readiness addresses", () => {
    expect(engineHttpBaseUrl({ host: "127.0.0.1", port: 49152 }).toString()).toBe("http://127.0.0.1:49152/");
  });
});
