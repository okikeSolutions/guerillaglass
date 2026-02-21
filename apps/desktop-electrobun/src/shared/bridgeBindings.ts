import type {
  BridgeRequestHandlerMap,
  BridgeRequestInvoker,
  HostMenuState,
  WindowBridgeBindings,
} from "./bridgeRpc";
import { bridgeRequestDefinitions, bridgeRequestNameList } from "./bridgeRpc";

export function createWindowBridgeBindings(
  invoke: BridgeRequestInvoker,
  sendHostMenuState: (state: HostMenuState) => void,
): WindowBridgeBindings {
  const bindings = Object.fromEntries(
    bridgeRequestNameList.map((name) => {
      const definition = bridgeRequestDefinitions[name];
      const toParams = definition.toParams as (...values: unknown[]) => unknown;
      const handler = (...args: unknown[]) =>
        invoke(name as never, toParams(...args) as never) as Promise<unknown>;
      return [name, handler];
    }),
  ) as WindowBridgeBindings;
  bindings.ggHostSendMenuState = sendHostMenuState;
  return bindings;
}

export function createBunBridgeHandlers(
  handlers: BridgeRequestHandlerMap,
): BridgeRequestHandlerMap {
  return handlers;
}
