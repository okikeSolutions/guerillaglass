import { Effect, Metric } from "effect";
import { bridgeRequestNameList } from "../../shared/bridge/desktopBridgeContract";
import { createBunBridgeHandlers } from "../../shared/bridge/desktopBridgeBindings";
import type { BunBridgeRequestHandlerMap } from "../../shared/bridge/desktopBridgeContract";
import type { DesktopAppRuntime } from "../app/AppRuntime";
import type { DesktopAppServices } from "../app/AppLayer";
import {
  desktopBridgeRequestDuration,
  desktopBridgeRequestFailuresTotal,
  desktopBridgeRequestsTotal,
} from "../app/AppMetrics";
import { redactBridgeErrorForRendererEffect } from "../security/BridgeErrorRedaction";
import { HostBridgeService } from "./HostBridgeService";

type BridgeHandlerDependencies = {
  runtime: DesktopAppRuntime;
};

/** Creates bridge RPC handlers that only route requests into HostBridgeService. */
export function createEngineBridgeHandlers({
  runtime,
}: BridgeHandlerDependencies): BunBridgeRequestHandlerMap {
  const run = (effect: Effect.Effect<unknown, unknown, unknown>): Promise<unknown> =>
    runtime.runPromise(effect as Effect.Effect<unknown, unknown, DesktopAppServices>);

  const handlers = createBunBridgeHandlers(
    Object.fromEntries(
      bridgeRequestNameList.map((name) => [
        name,
        (params: unknown) =>
          run(
            Effect.gen(function* () {
              const bridge = yield* HostBridgeService;
              return yield* bridge.handle(name, params as never);
            }).pipe(
              Effect.ensuring(
                Metric.update(
                  Metric.withAttributes(desktopBridgeRequestsTotal, { request: name }),
                  1,
                ),
              ),
              Effect.trackDuration(
                Metric.withAttributes(desktopBridgeRequestDuration, { request: name }),
              ),
              Effect.annotateLogs({
                bridgeRequest: name,
                component: "desktop-bridge",
              }),
              Effect.withLogSpan("bridge-request"),
              Effect.withSpan(`bridge.${name}`, {
                attributes: {
                  "bridge.request": name,
                },
              }),
            ),
          ),
      ]),
    ) as never,
  );

  return Object.fromEntries(
    bridgeRequestNameList.map((name) => [
      name,
      async (params: never) => {
        const response = await handlers[name](params);
        if (response.ok) {
          return response;
        }
        await run(
          Effect.all(
            [
              Metric.update(
                Metric.withAttributes(desktopBridgeRequestFailuresTotal, { request: name }),
                1,
              ),
              Effect.logError("desktop bridge request failed").pipe(
                Effect.annotateLogs({
                  bridgeErrorData: response.error.data ?? null,
                  bridgeErrorMessage: response.error.message ?? null,
                  bridgeErrorTag: response.error.tag,
                  bridgeRequest: name,
                  component: "desktop-bridge",
                }),
              ),
            ],
            { discard: true },
          ),
        );
        const error = await run(redactBridgeErrorForRendererEffect(response.error));
        return { ...response, error };
      },
    ]),
  ) as BunBridgeRequestHandlerMap;
}
