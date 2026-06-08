import { Effect } from "effect";
import { bridgeRequestNameList } from "../../shared/bridge/desktopBridgeContract";
import { createBunBridgeHandlers } from "../../shared/bridge/desktopBridgeBindings";
import type { BunBridgeRequestHandlerMap } from "../../shared/bridge/desktopBridgeContract";
import type { DesktopAppRuntime } from "../app/AppRuntime";
import type { DesktopAppServices } from "../app/AppLayer";
import { redactBridgeErrorForRendererEffect } from "../security/BridgeErrorRedaction";
import { HostBridgeService } from "./HostBridgeService";

type BridgeHandlerDependencies = {
  runtime: DesktopAppRuntime;
};

/** Creates bridge RPC handlers that only route requests into HostBridgeService. */
export function createEngineBridgeHandlers({
  runtime,
}: BridgeHandlerDependencies): BunBridgeRequestHandlerMap {
  const run = (effect: Effect.Effect<unknown, unknown, unknown>): Promise<any> =>
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
            }),
          ),
      ]),
    ) as never,
  );

  return Object.fromEntries(
    bridgeRequestNameList.map((name) => [
      name,
      async (params: never) => {
        const response = await handlers[name](params);
        if (response.ok) return response;
        const error = await run(redactBridgeErrorForRendererEffect(response.error));
        return { ...response, error };
      },
    ]),
  ) as BunBridgeRequestHandlerMap;
}
