import type {
  BunBridgeRequestHandlerMap,
  BridgeRequestName,
  BridgeRequestHandlerMap,
  BridgeRequestInvoker,
  BridgeRequests,
  HostMenuState,
  WindowBridgeBindings,
} from "./bridgeRpc";
import { deserializeBridgeError, serializeBridgeError } from "./errors";
import { bridgeRequestDefinitions, bridgeRequestNameList } from "./bridgeRpc";

export function createWindowBridgeBindings(
  invoke: BridgeRequestInvoker,
  sendHostMenuState: (state: HostMenuState) => void,
): WindowBridgeBindings {
  function createBinding<K extends BridgeRequestName>(name: K) {
    const definition = bridgeRequestDefinitions[name];
    const toParams = definition.toParams as (...values: unknown[]) => BridgeRequests[K]["params"];

    return async (...args: unknown[]) => {
      const response = await invoke(name, toParams(...args));
      if (response.ok) {
        return response.data;
      }
      throw deserializeBridgeError(response.error);
    };
  }

  const bindings = Object.fromEntries(
    bridgeRequestNameList.map((name) => {
      return [name, createBinding(name)];
    }),
  ) as WindowBridgeBindings;
  bindings.ggHostSendMenuState = sendHostMenuState;
  return bindings;
}

export function createBunBridgeHandlers(
  handlers: BridgeRequestHandlerMap,
): BunBridgeRequestHandlerMap {
  return Object.fromEntries(
    bridgeRequestNameList.map((name) => {
      const handler = handlers[name] as (params: unknown) => Promise<unknown>;
      return [
        name,
        async (params: unknown) => {
          try {
            const data = await handler(params);
            return {
              ok: true as const,
              data,
            };
          } catch (error) {
            return {
              ok: false as const,
              error: serializeBridgeError(error),
            };
          }
        },
      ];
    }),
  ) as BunBridgeRequestHandlerMap;
}
