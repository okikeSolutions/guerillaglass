import type {
  AgentPreflightResult,
  AgentRunResult,
  AgentStatusResult,
} from "@guerillaglass/engine-contract/domains/agent";
import type {
  CapturePreviewFrameResult,
  CaptureStatusResult,
} from "@guerillaglass/engine-contract/domains/capture";
import type {
  ExportInfoResult,
  ExportRunCutPlanResult,
  ExportRunResult,
} from "@guerillaglass/engine-contract/domains/export";
import type {
  ActionResult,
  PermissionsResult,
} from "@guerillaglass/engine-contract/domains/permissions";
import type {
  ProjectRecentsResult,
  ProjectState,
} from "@guerillaglass/engine-contract/domains/project";
import type { SourcesResult } from "@guerillaglass/engine-contract/domains/sources";
import type { CapabilitiesResult, PingResult } from "@guerillaglass/engine-contract/domains/system";
import { EngineHttpApi } from "@guerillaglass/engine-contract/httpApi";
import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import { Context, Effect, Layer } from "effect";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";
import { EngineClientConfig, type EngineClientOptions } from "./config";
import type { EngineClientError } from "./errors";
import { makeEngineHttpProcess, type EngineHttpProcessOptions } from "./process/launchBun";

/**
 * Input for Agent Mode preflight checks.
 */
export type AgentPreflightRequest = Record<string, unknown>;

/**
 * Input for creating an Agent Mode job.
 */
export type AgentRunRequest = Record<string, unknown>;

/**
 * Input for applying an Agent Mode job result.
 */
export type AgentApplyRequest = Record<string, unknown>;

/**
 * Input for capture start commands.
 */
export type CaptureStartRequest = Record<string, unknown>;

/**
 * Input for starting a recording session.
 */
export type RecordingStartRequest = Record<string, unknown>;

/**
 * Input for standard export jobs.
 */
export type ExportRunRequest = Record<string, unknown>;

/**
 * Input for export jobs created from Agent Mode cut plans.
 */
export type ExportRunCutPlanRequest = Record<string, unknown>;

/**
 * Input for opening a project from disk.
 */
export type ProjectOpenRequest = Record<string, unknown>;

/**
 * Input for saving current project state.
 */
export type ProjectSaveRequest = Record<string, unknown>;

/**
 * Generated low-level client shape derived directly from `EngineHttpApi`.
 */
export type RawEngineHttpApiClient = HttpApiClient.ForApi<typeof EngineHttpApi>;

/**
 * Effect-native service for the v2 native engine HTTP client.
 */
export type EngineClientService = {
  /**
   * Calls `GET /v1/system/ping`.
   */
  readonly systemPing: Effect.Effect<PingResult, EngineClientError>;
  /**
   * Calls `GET /v1/engine/capabilities`.
   */
  readonly engineCapabilities: Effect.Effect<CapabilitiesResult, EngineClientError>;
  /**
   * Calls `POST /v1/agent/preflight`.
   */
  readonly agentPreflight: (
    request: AgentPreflightRequest,
  ) => Effect.Effect<AgentPreflightResult, EngineClientError>;
  /**
   * Calls `POST /v1/agent/runs`.
   */
  readonly agentRun: (request: AgentRunRequest) => Effect.Effect<AgentRunResult, EngineClientError>;
  /**
   * Calls `GET /v1/agent/runs/{jobId}`.
   */
  readonly agentStatus: (jobId: string) => Effect.Effect<AgentStatusResult, EngineClientError>;
  /**
   * Calls `POST /v1/agent/runs/{jobId}/apply`.
   */
  readonly agentApply: (
    jobId: string,
    request: AgentApplyRequest,
  ) => Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Calls `GET /v1/permissions`.
   */
  readonly permissionsGet: Effect.Effect<PermissionsResult, EngineClientError>;
  /**
   * Calls `POST /v1/permissions/screen-recording/request`.
   */
  readonly permissionsRequestScreenRecording: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Calls `POST /v1/permissions/microphone/request`.
   */
  readonly permissionsRequestMicrophone: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Calls `POST /v1/permissions/input-monitoring/request`.
   */
  readonly permissionsRequestInputMonitoring: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Calls `POST /v1/permissions/input-monitoring/open-settings`.
   */
  readonly permissionsOpenInputMonitoringSettings: Effect.Effect<ActionResult, EngineClientError>;
  /**
   * Calls `GET /v1/sources`.
   */
  readonly sourcesList: Effect.Effect<SourcesResult, EngineClientError>;
  /**
   * Calls `POST /v1/capture/start-display`.
   */
  readonly captureStartDisplay: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `POST /v1/capture/start-current-window`.
   */
  readonly captureStartCurrentWindow: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `POST /v1/capture/start-window`.
   */
  readonly captureStartWindow: (
    request: CaptureStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `POST /v1/capture/stop`.
   */
  readonly captureStop: Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `GET /v1/capture/status`.
   */
  readonly captureStatus: Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `GET /v1/capture/preview-frame`.
   */
  readonly capturePreviewFrame: Effect.Effect<CapturePreviewFrameResult, EngineClientError>;
  /**
   * Calls `POST /v1/recording/start`.
   */
  readonly recordingStart: (
    request: RecordingStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `POST /v1/recording/stop`.
   */
  readonly recordingStop: Effect.Effect<CaptureStatusResult, EngineClientError>;
  /**
   * Calls `GET /v1/export/info`.
   */
  readonly exportInfo: Effect.Effect<ExportInfoResult, EngineClientError>;
  /**
   * Calls `POST /v1/exports`.
   */
  readonly exportRun: (
    request: ExportRunRequest,
  ) => Effect.Effect<ExportRunResult, EngineClientError>;
  /**
   * Calls `POST /v1/exports/from-cut-plan`.
   */
  readonly exportRunCutPlan: (
    request: ExportRunCutPlanRequest,
  ) => Effect.Effect<ExportRunCutPlanResult, EngineClientError>;
  /**
   * Calls `GET /v1/exports/{jobId}`.
   */
  readonly exportGet: (jobId: string) => Effect.Effect<ExportRunResult, EngineClientError>;
  /**
   * Calls `GET /v1/project/current`.
   */
  readonly projectCurrent: Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Calls `POST /v1/project/open`.
   */
  readonly projectOpen: (
    request: ProjectOpenRequest,
  ) => Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Calls `POST /v1/project/save`.
   */
  readonly projectSave: (
    request: ProjectSaveRequest,
  ) => Effect.Effect<ProjectState, EngineClientError>;
  /**
   * Calls `GET /v1/project/recents`.
   */
  readonly projectRecents: (
    limit?: number,
  ) => Effect.Effect<ProjectRecentsResult, EngineClientError>;
};

/**
 * Context tag for the v2 engine client service.
 */
export class EngineClient extends Context.Service<EngineClient, EngineClientService>()(
  "@guerillaglass/engine-client/EngineClient",
) {}

const asClientEffect = <A>(
  effect: Effect.Effect<A, unknown, unknown>,
): Effect.Effect<A, EngineClientError> => effect as Effect.Effect<A, EngineClientError>;

/**
 * Builds the generated low-level `HttpApiClient` from explicit client options.
 *
 * @param options - Engine HTTP client options.
 * @returns An effect that constructs the generated client.
 */
export function makeBearerHttpClientTransform(
  bearerToken: EngineClientOptions["bearerToken"],
): (client: HttpClient.HttpClient) => HttpClient.HttpClient {
  return (client) =>
    client.pipe(
      HttpClient.mapRequest((request) => HttpClientRequest.bearerToken(request, bearerToken)),
    );
}

export function makeRawEngineHttpApiClient(
  options: EngineClientOptions,
): Effect.Effect<RawEngineHttpApiClient, never, HttpClient.HttpClient> {
  return HttpApiClient.make(EngineHttpApi, {
    baseUrl: options.baseUrl,
    transformClient: makeBearerHttpClientTransform(options.bearerToken),
  });
}

/**
 * Wraps the generated `HttpApiClient` in stable domain-oriented method names.
 *
 * @param rawClient - Generated client returned by `HttpApiClient.make`.
 * @returns The low-level EngineClient service implementation.
 */
export function makeEngineClientService(rawClient: RawEngineHttpApiClient): EngineClientService {
  const client = rawClient as any;
  return {
    systemPing: asClientEffect(client.system.systemPing({})),
    engineCapabilities: asClientEffect(client.system.engineCapabilities({})),
    agentPreflight: (request) => asClientEffect(client.agent.agentPreflight({ payload: request })),
    agentRun: (request) => asClientEffect(client.agent.agentRun({ payload: request })),
    agentStatus: (jobId) => asClientEffect(client.agent.agentStatus({ params: { jobId } })),
    agentApply: (jobId, request) =>
      asClientEffect(client.agent.agentApply({ params: { jobId }, payload: request })),
    permissionsGet: asClientEffect(client.permissions.permissionsGet({})),
    permissionsRequestScreenRecording: asClientEffect(
      client.permissions.permissionsRequestScreenRecording({}),
    ),
    permissionsRequestMicrophone: asClientEffect(
      client.permissions.permissionsRequestMicrophone({}),
    ),
    permissionsRequestInputMonitoring: asClientEffect(
      client.permissions.permissionsRequestInputMonitoring({}),
    ),
    permissionsOpenInputMonitoringSettings: asClientEffect(
      client.permissions.permissionsOpenInputMonitoringSettings({}),
    ),
    sourcesList: asClientEffect(client.sources.sourcesList({})),
    captureStartDisplay: (request) =>
      asClientEffect(client.capture.captureStartDisplay({ payload: request })),
    captureStartCurrentWindow: (request) =>
      asClientEffect(client.capture.captureStartCurrentWindow({ payload: request })),
    captureStartWindow: (request) =>
      asClientEffect(client.capture.captureStartWindow({ payload: request })),
    captureStop: asClientEffect(client.capture.captureStop({})),
    captureStatus: asClientEffect(client.capture.captureStatus({})),
    capturePreviewFrame: asClientEffect(client.capture.capturePreviewFrame({})),
    recordingStart: (request) =>
      asClientEffect(client.recording.recordingStart({ payload: request })),
    recordingStop: asClientEffect(client.recording.recordingStop({})),
    exportInfo: asClientEffect(client.export.exportInfo({})),
    exportRun: (request) => asClientEffect(client.export.exportRun({ payload: request })),
    exportRunCutPlan: (request) =>
      asClientEffect(client.export.exportRunCutPlan({ payload: request })),
    exportGet: (jobId) => asClientEffect(client.export.exportGet({ params: { jobId } })),
    projectCurrent: asClientEffect(client.project.projectCurrent({})),
    projectOpen: (request) => asClientEffect(client.project.projectOpen({ payload: request })),
    projectSave: (request) => asClientEffect(client.project.projectSave({ payload: request })),
    projectRecents: (limit) => asClientEffect(client.project.projectRecents({ query: { limit } })),
  };
}

/**
 * Layer that builds the v2 engine client from explicit options.
 *
 * @param options - Explicit engine client options.
 * @returns A layer providing {@link EngineClient}.
 */
export function layerEngineClient(
  options: EngineClientOptions,
): Layer.Layer<EngineClient, never, HttpClient.HttpClient> {
  return Layer.effect(
    EngineClient,
    Effect.map(makeRawEngineHttpApiClient(options), (rawClient) =>
      EngineClient.of(makeEngineClientService(rawClient)),
    ),
  );
}

/**
 * Layer that builds the v2 engine client from Effect `Config`.
 */
export const layerEngineClientFromConfig = Layer.effect(
  EngineClient,
  Effect.gen(function* () {
    const config = yield* EngineClientConfig;
    const rawClient = yield* makeRawEngineHttpApiClient(config);
    return EngineClient.of(makeEngineClientService(rawClient));
  }),
);

/**
 * Bun-backed layer that launches a scoped native engine process and provides `EngineClient`.
 *
 * @param options - Native engine process launch options.
 * @returns A scoped layer providing {@link EngineClient}.
 */
export function layerEngineClientBun(
  options?: EngineHttpProcessOptions,
): Layer.Layer<EngineClient, unknown> {
  return Layer.effect(
    EngineClient,
    Effect.gen(function* () {
      const engineProcess = yield* makeEngineHttpProcess(options);
      const rawClient = yield* makeRawEngineHttpApiClient({
        baseUrl: engineProcess.baseUrl,
        bearerToken: engineProcess.bearerToken,
        requestTimeoutMs: 30_000,
      }).pipe(Effect.provide(BunHttpClient.layer));
      return EngineClient.of(makeEngineClientService(rawClient));
    }),
  );
}
