import type {
  ActionResult,
  PermissionsResult,
} from "@guerillaglass/engine-contract/domains/permissions";
import { Context, Effect, Layer } from "effect";
import type { EngineClientFailure } from "../errors";
import { EngineClient } from "../service";

/**
 * Domain service for platform permission operations.
 */
export type PermissionsServiceShape = {
  /**
   * Reads the current platform permission snapshot.
   */
  readonly get: Effect.Effect<PermissionsResult, EngineClientFailure>;
  /**
   * Requests Screen Recording permission.
   */
  readonly requestScreenRecording: Effect.Effect<ActionResult, EngineClientFailure>;
  /**
   * Requests Microphone permission.
   */
  readonly requestMicrophone: Effect.Effect<ActionResult, EngineClientFailure>;
  /**
   * Requests Input Monitoring permission.
   */
  readonly requestInputMonitoring: Effect.Effect<ActionResult, EngineClientFailure>;
  /**
   * Opens the Input Monitoring settings pane.
   */
  readonly openInputMonitoringSettings: Effect.Effect<ActionResult, EngineClientFailure>;
};

/**
 * Effect service tag for permission-domain engine operations.
 */
export class PermissionsService extends Context.Service<
  PermissionsService,
  PermissionsServiceShape
>()("@guerillaglass/engine-client/PermissionsService") {}

/**
 * Layer deriving permission-domain operations from {@link EngineClient}.
 */
export const layerPermissionsService: Layer.Layer<PermissionsService, never, EngineClient> =
  Layer.effect(
    PermissionsService,
    Effect.gen(function* () {
      const client = yield* EngineClient;
      return PermissionsService.of({
        get: client.permissionsGet,
        requestScreenRecording: client.permissionsRequestScreenRecording,
        requestMicrophone: client.permissionsRequestMicrophone,
        requestInputMonitoring: client.permissionsRequestInputMonitoring,
        openInputMonitoringSettings: client.permissionsOpenInputMonitoringSettings,
      });
    }),
  );
