import type {
  BunBridgeRequestHandlerMap,
  BridgeRequestName,
  BridgeRequestHandlerMap,
  BridgeRequestInvoker,
  BridgeRequests,
  HostMenuState,
  StudioDiagnosticsEntry,
  WindowBridgeBindings,
} from "./desktopBridgeContract";
import {
  decodeUnknownWithSchemaSync,
  encodeUnknownWithSchemaSync,
  validateEncodedUnknownWithSchemaSync,
} from "@guerillaglass/engine/client/errors/schemaContracts";
import { deserializeBridgeError, serializeBridgeError } from "../errors/desktopErrorSerialization";
import { bridgeRequestDefinitions, bridgeRequestNameList } from "./desktopBridgeContract";

/**
 * Builds the renderer-facing bridge object from a generic request invoker.
 *
 * Each generated binding normalizes positional arguments into the canonical request
 * payload, validates typed responses when a schema is available, and rehydrates Bun-side
 * failures into local tagged errors.
 */
export function createWindowBridgeBindings(
  invoke: BridgeRequestInvoker,
  sendHostMenuState: (state: HostMenuState) => void,
  sendStudioDiagnostics: (entry: StudioDiagnosticsEntry) => void,
): WindowBridgeBindings {
  function createBinding<K extends BridgeRequestName>(name: K) {
    const definition = bridgeRequestDefinitions[name];
    const toParams = definition.toParams as (...values: unknown[]) => BridgeRequests[K]["params"];

    return async (...args: unknown[]) => {
      const response = await invoke(name, toParams(...args));
      if (response.ok) {
        if (!definition.responseSchema) {
          return response.data;
        }
        return validateEncodedUnknownWithSchemaSync(
          definition.responseSchema,
          response.data,
          `${name} bridge response`,
        );
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
  bindings.ggHostSendStudioDiagnostics = sendStudioDiagnostics;
  return bindings;
}

/**
 * Wraps logical Bun bridge handlers in the standard success/error transport envelope.
 *
 * The wrapper validates request params and responses when schemas are defined so
 * malformed payloads are caught at the host boundary before reaching callers.
 */
export function createBunBridgeHandlers(
  handlers: BridgeRequestHandlerMap,
): BunBridgeRequestHandlerMap {
  return Object.fromEntries(
    bridgeRequestNameList.map((name) => {
      const handler = handlers[name] as (params: unknown) => Promise<unknown>;
      const definition = bridgeRequestDefinitions[name];
      return [
        name,
        async (params: unknown) => {
          try {
            const validatedParams = definition.paramsSchema
              ? decodeUnknownWithSchemaSync(
                  definition.paramsSchema,
                  params,
                  `${name} bridge params`,
                )
              : params;
            const data = await handler(validatedParams);
            const validatedData = definition.responseSchema
              ? encodeUnknownWithSchemaSync(
                  definition.responseSchema,
                  data,
                  `${name} bridge response`,
                )
              : data;
            return {
              ok: true as const,
              data: validatedData,
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
