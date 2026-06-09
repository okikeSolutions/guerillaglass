import { describe, expect, test } from "vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { HttpClient, HttpClientRequest, Headers } from "effect/unstable/http";
import { SystemService, layerSystemService } from "../src/services/SystemService";
import {
  EngineClient,
  makeBearerHttpClientTransform,
  makeEngineClientService,
  type RawEngineHttpApiClient,
} from "../src/service";

describe("EngineClient service", () => {
  test("decorates low-level HTTP requests with bearer auth", async () => {
    let authorization: unknown;
    const client = makeBearerHttpClientTransform(Redacted.make("token-123"))(
      HttpClient.make((request) =>
        Effect.sync(() => {
          authorization = Headers.get(request.headers, "authorization");
        }).pipe(Effect.flatMap(() => Effect.die("stop after request capture"))),
      ),
    );

    await Effect.runPromiseExit(
      client.execute(HttpClientRequest.get("http://127.0.0.1/v1/system/ping")),
    );

    expect(Option.getOrUndefined(authorization as Option.Option<string>)).toBe("Bearer token-123");
  });

  test("wraps a generated low-level client in stable method names", async () => {
    const emptyGroup = new Proxy({}, { get: () => () => Effect.succeed({}) });
    const rawClient = {
      system: {
        systemPing: (request: unknown) =>
          Effect.succeed({
            request,
            app: "guerillaglass",
            engineVersion: "0.0.0-test",
            protocolVersion: "2",
            platform: "test",
          }),
        engineCapabilities: () => Effect.succeed({}),
      },
      agent: emptyGroup,
      permissions: emptyGroup,
      sources: emptyGroup,
      capture: emptyGroup,
      recording: emptyGroup,
      export: emptyGroup,
      project: emptyGroup,
    } as unknown as RawEngineHttpApiClient;

    const client = makeEngineClientService(rawClient);
    const ping = await Effect.runPromise(client.systemPing);

    expect(ping.protocolVersion).toBe("2");
  });

  test("derives domain services from EngineClient", async () => {
    const effect = Effect.gen(function* () {
      const system = yield* SystemService;
      const ping = yield* system.ping;
      return ping;
    });

    const ping = await Effect.runPromise(
      effect.pipe(
        Effect.provide(
          Layer.provide(
            layerSystemService,
            Layer.succeed(EngineClient, {
              systemPing: Effect.succeed({
                app: "guerillaglass",
                engineVersion: "0.0.0-test",
                protocolVersion: "2",
                platform: "test",
              }),
              engineCapabilities: Effect.die("unused"),
            } as never),
          ),
        ),
      ),
    );

    expect(ping.platform).toBe("test");
  });
});
