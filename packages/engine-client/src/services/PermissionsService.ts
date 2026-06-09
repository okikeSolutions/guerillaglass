import type { ActionResult, PermissionsResult } from "@guerillaglass/engine-contract/domains/permissions";
import { Context, Effect, Layer } from "effect";
import type { EngineClientError } from "../errors";
import { EngineClient } from "../service";

/**
 * Domain service for platform permission operations.
 */
export type PermissionsServiceShape = {
  /**
   * Reads the current platform permission snapshot.
   */
  readonly get: Effect.Effect<PermissionsResult, EngineClientError>;
  /**
   * Requests Screen Recording permission.
   */
  readonly requestScreenRecording: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Requests Microphone permission.
   */
  readonly requestMicrophone: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Requests Input Monitoring permission.
   */
  readonly requestInputMonitoring: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Opens the Input Monitoring settings pane.
   */
  readonly openInputMonitoringSettings: Effect.Effect<ActionResult, EngineClientError>;
};

/**
 * Effect service tag for permission-domain engine operations.
 */
export class PermissionsService extends Context.Service<PermissionsService, PermissionsServiceShape>()(
  "@guerillaglass/engine-client/PermissionsService",
) {}

/**
 * Layer deriving permission-domain operations from {@link EngineClient}.
 */
export const layerPermissionsService: Layer.Layer<PermissionsService, never, EngineClient> = Layer.effect(
  PermissionsService,
  Effect.map(EngineClient, (client) =>
    PermissionsService.of({
      get: client.permissionsGet,
      requestScreenRecording: client.permissionsRequestScreenRecording,
      requestMicrophone: client.permissionsRequestMicrophone,
      requestInputMonitoring: client.permissionsRequestInputMonitoring,
      openInputMonitoringSettings: client.permissionsOpenInputMonitoringSettings,
    }),
  ),
);
