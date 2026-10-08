import type {
  AgentApplyResult,
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
import {
  agentApplyPayloadSchema,
  agentPreflightPayloadSchema,
  agentRunPayloadSchema,
  captureStartCurrentWindowPayloadSchema,
  captureStartDisplayPayloadSchema,
  captureStartWindowPayloadSchema,
  EngineHttpApi,
  exportRunCutPlanPayloadSchema,
  exportRunPayloadSchema,
  projectOpenPayloadSchema,
  projectSavePayloadSchema,
  recordingStartPayloadSchema,
} from "@guerillaglass/engine-contract/httpApi";
import type { AgentJobId, ExportJobId } from "@guerillaglass/engine-contract/schema-primitives";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { EngineClientConfig, type EngineClientOptions } from "./config";
import { EngineClientError, EngineResponseError, type EngineProcessError } from "./errors";
import { makeEngineHttpProcess, type EngineHttpProcessOptions } from "./process/launchBun";

/**
 * Input for Agent Mode preflight checks.
 */
export const AgentPreflightRequest = agentPreflightPayloadSchema;
export interface AgentPreflightRequest extends Schema.Schema.Type<typeof AgentPreflightRequest> {}

/**
 * Input for creating an Agent Mode job.
 */
export const AgentRunRequest = agentRunPayloadSchema;
export interface AgentRunRequest extends Schema.Schema.Type<typeof AgentRunRequest> {}

/**
 * Input for applying an Agent Mode job result.
 */
export const AgentApplyRequest = agentApplyPayloadSchema;
export interface AgentApplyRequest extends Schema.Schema.Type<typeof AgentApplyRequest> {}

/**
 * Input for capture start commands.
 */
export const CaptureStartDisplayRequest = captureStartDisplayPayloadSchema;
export interface CaptureStartDisplayRequest extends Schema.Schema.Type<
  typeof CaptureStartDisplayRequest
> {}

/**
 * Input for capture start-current-window commands.
 */
export const CaptureStartCurrentWindowRequest = captureStartCurrentWindowPayloadSchema;
export interface CaptureStartCurrentWindowRequest extends Schema.Schema.Type<
  typeof CaptureStartCurrentWindowRequest
> {}

/**
 * Input for capture start-window commands.
 */
export const CaptureStartWindowRequest = captureStartWindowPayloadSchema;
export interface CaptureStartWindowRequest extends Schema.Schema.Type<
  typeof CaptureStartWindowRequest
> {}

/**
 * Input for starting a recording session.
 */
export const RecordingStartRequest = recordingStartPayloadSchema;
export interface RecordingStartRequest extends Schema.Schema.Type<typeof RecordingStartRequest> {}

/**
 * Input for standard export jobs.
 */
export const ExportRunRequest = exportRunPayloadSchema;
export interface ExportRunRequest extends Schema.Schema.Type<typeof ExportRunRequest> {}

/**
 * Input for export jobs created from Agent Mode cut plans.
 */
export const ExportRunCutPlanRequest = exportRunCutPlanPayloadSchema;
export interface ExportRunCutPlanRequest extends Schema.Schema.Type<
  typeof ExportRunCutPlanRequest
> {}

/**
 * Input for opening a project from disk.
 */
export const ProjectOpenRequest = projectOpenPayloadSchema;
export interface ProjectOpenRequest extends Schema.Schema.Type<typeof ProjectOpenRequest> {}

/**
 * Input for saving current project state.
 */
export const ProjectSaveRequest = projectSavePayloadSchema;
export interface ProjectSaveRequest extends Schema.Schema.Type<typeof ProjectSaveRequest> {}

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
  readonly systemPing: Effect.Effect<PingResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/engine/capabilities`.
   */
  readonly engineCapabilities: Effect.Effect<
    CapabilitiesResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/agent/preflight`.
   */
  readonly agentPreflight: (
    request: AgentPreflightRequest,
  ) => Effect.Effect<AgentPreflightResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/agent/runs`.
   */
  readonly agentRun: (
    request: AgentRunRequest,
  ) => Effect.Effect<AgentRunResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/agent/runs/{jobId}`.
   */
  readonly agentStatus: (
    jobId: AgentJobId,
  ) => Effect.Effect<AgentStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/agent/runs/{jobId}/apply`.
   */
  readonly agentApply: (
    jobId: AgentJobId,
    request: AgentApplyRequest,
  ) => Effect.Effect<AgentApplyResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/permissions`.
   */
  readonly permissionsGet: Effect.Effect<
    PermissionsResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/permissions/screen-recording/request`.
   */
  readonly permissionsRequestScreenRecording: Effect.Effect<
    ActionResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/permissions/microphone/request`.
   */
  readonly permissionsRequestMicrophone: Effect.Effect<
    ActionResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/permissions/input-monitoring/request`.
   */
  readonly permissionsRequestInputMonitoring: Effect.Effect<
    ActionResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/permissions/input-monitoring/open-settings`.
   */
  readonly permissionsOpenInputMonitoringSettings: Effect.Effect<
    ActionResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `GET /v1/sources`.
   */
  readonly sourcesList: Effect.Effect<SourcesResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/capture/start-display`.
   */
  readonly captureStartDisplay: (
    request: CaptureStartDisplayRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/capture/start-current-window`.
   */
  readonly captureStartCurrentWindow: (
    request: CaptureStartCurrentWindowRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/capture/start-window`.
   */
  readonly captureStartWindow: (
    request: CaptureStartWindowRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/capture/stop`.
   */
  readonly captureStop: Effect.Effect<CaptureStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/capture/status`.
   */
  readonly captureStatus: Effect.Effect<
    CaptureStatusResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `GET /v1/capture/preview-frame`.
   */
  readonly capturePreviewFrame: Effect.Effect<
    CapturePreviewFrameResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `POST /v1/recording/start`.
   */
  readonly recordingStart: (
    request: RecordingStartRequest,
  ) => Effect.Effect<CaptureStatusResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/recording/stop`.
   */
  readonly recordingStop: Effect.Effect<
    CaptureStatusResult,
    EngineClientError | EngineResponseError
  >;
  /**
   * Calls `GET /v1/export/info`.
   */
  readonly exportInfo: Effect.Effect<ExportInfoResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/exports`.
   */
  readonly exportRun: (
    request: ExportRunRequest,
  ) => Effect.Effect<ExportRunResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/exports/from-cut-plan`.
   */
  readonly exportRunCutPlan: (
    request: ExportRunCutPlanRequest,
  ) => Effect.Effect<ExportRunCutPlanResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/exports/{jobId}`.
   */
  readonly exportGet: (
    jobId: ExportJobId,
  ) => Effect.Effect<ExportRunResult, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/project/current`.
   */
  readonly projectCurrent: Effect.Effect<ProjectState, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/project/open`.
   */
  readonly projectOpen: (
    request: ProjectOpenRequest,
  ) => Effect.Effect<ProjectState, EngineClientError | EngineResponseError>;
  /**
   * Calls `POST /v1/project/save`.
   */
  readonly projectSave: (
    request: ProjectSaveRequest,
  ) => Effect.Effect<ProjectState, EngineClientError | EngineResponseError>;
  /**
   * Calls `GET /v1/project/recents`.
   */
  readonly projectRecents: (
    limit?: number,
  ) => Effect.Effect<ProjectRecentsResult, EngineClientError | EngineResponseError>;
};

/**
 * Context tag for the v2 engine client service.
 */
export class EngineClient extends Context.Service<EngineClient, EngineClientService>()(
  "@guerillaglass/engine-client/EngineClient",
) {}

const normalizeClientFailure = Effect.fn("service.normalizeClientFailure")(
  <A>(
    effect: Effect.Effect<A, unknown>,
  ): Effect.Effect<A, EngineClientError | EngineResponseError> =>
    effect.pipe(
      Effect.mapError((cause) => {
        if (cause instanceof EngineClientError) {
          return cause;
        }
        if (
          typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          "message" in cause &&
          typeof cause.code === "string" &&
          typeof cause.message === "string"
        ) {
          return new EngineResponseError({ code: cause.code, description: cause.message });
        }
        return new EngineClientError({
          code: "ENGINE_HTTP_REQUEST_FAILED",
          description: "Engine HTTP request failed.",
          cause,
        });
      }),
    ),
);

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

export const makeRawEngineHttpApiClient = Effect.fn("service.makeRawEngineHttpApiClient")(function (
  options: EngineClientOptions,
): Effect.Effect<RawEngineHttpApiClient, never, HttpClient.HttpClient> {
  return HttpApiClient.make(EngineHttpApi, {
    baseUrl: options.baseUrl,
    transformClient: makeBearerHttpClientTransform(options.bearerToken),
  });
});

/**
 * Wraps the generated `HttpApiClient` in stable domain-oriented method names.
 *
 * @param rawClient - Generated client returned by `HttpApiClient.make`.
 * @returns The low-level EngineClient service implementation.
 */
export function makeEngineClientService(rawClient: RawEngineHttpApiClient): EngineClientService {
  const client = rawClient;
  return EngineClient.of({
    systemPing: normalizeClientFailure(client.system.systemPing({})),
    engineCapabilities: normalizeClientFailure(client.system.engineCapabilities({})),
    agentPreflight: Effect.fn("EngineClient.agentPreflight")(
      (request: Parameters<EngineClientService["agentPreflight"]>[0]) =>
        normalizeClientFailure(client.agent.agentPreflight({ payload: request })),
    ),
    agentRun: Effect.fn("EngineClient.agentRun")(
      (request: Parameters<EngineClientService["agentRun"]>[0]) =>
        normalizeClientFailure(client.agent.agentRun({ payload: request })),
    ),
    agentStatus: Effect.fn("EngineClient.agentStatus")(
      (jobId: Parameters<EngineClientService["agentStatus"]>[0]) =>
        normalizeClientFailure(client.agent.agentStatus({ params: { jobId } })),
    ),
    agentApply: Effect.fn("EngineClient.agentApply")(
      (
        jobId: Parameters<EngineClientService["agentApply"]>[0],
        request: Parameters<EngineClientService["agentApply"]>[1],
      ) => normalizeClientFailure(client.agent.agentApply({ params: { jobId }, payload: request })),
    ),
    permissionsGet: normalizeClientFailure(client.permissions.permissionsGet({})),
    permissionsRequestScreenRecording: normalizeClientFailure(
      client.permissions.permissionsRequestScreenRecording({}),
    ),
    permissionsRequestMicrophone: normalizeClientFailure(
      client.permissions.permissionsRequestMicrophone({}),
    ),
    permissionsRequestInputMonitoring: normalizeClientFailure(
      client.permissions.permissionsRequestInputMonitoring({}),
    ),
    permissionsOpenInputMonitoringSettings: normalizeClientFailure(
      client.permissions.permissionsOpenInputMonitoringSettings({}),
    ),
    sourcesList: normalizeClientFailure(client.sources.sourcesList({})),
    captureStartDisplay: Effect.fn("EngineClient.captureStartDisplay")(
      (request: Parameters<EngineClientService["captureStartDisplay"]>[0]) =>
        normalizeClientFailure(client.capture.captureStartDisplay({ payload: request })),
    ),
    captureStartCurrentWindow: Effect.fn("EngineClient.captureStartCurrentWindow")(
      (request: Parameters<EngineClientService["captureStartCurrentWindow"]>[0]) =>
        normalizeClientFailure(client.capture.captureStartCurrentWindow({ payload: request })),
    ),
    captureStartWindow: Effect.fn("EngineClient.captureStartWindow")(
      (request: Parameters<EngineClientService["captureStartWindow"]>[0]) =>
        normalizeClientFailure(client.capture.captureStartWindow({ payload: request })),
    ),
    captureStop: normalizeClientFailure(client.capture.captureStop({})),
    captureStatus: normalizeClientFailure(client.capture.captureStatus({})),
    capturePreviewFrame: normalizeClientFailure(client.capture.capturePreviewFrame({})),
    recordingStart: Effect.fn("EngineClient.recordingStart")(
      (request: Parameters<EngineClientService["recordingStart"]>[0]) =>
        normalizeClientFailure(client.recording.recordingStart({ payload: request })),
    ),
    recordingStop: normalizeClientFailure(client.recording.recordingStop({})),
    exportInfo: normalizeClientFailure(client.export.exportInfo({})),
    exportRun: Effect.fn("EngineClient.exportRun")(
      (request: Parameters<EngineClientService["exportRun"]>[0]) =>
        normalizeClientFailure(client.export.exportRun({ payload: request })),
    ),
    exportRunCutPlan: Effect.fn("EngineClient.exportRunCutPlan")(
      (request: Parameters<EngineClientService["exportRunCutPlan"]>[0]) =>
        normalizeClientFailure(client.export.exportRunCutPlan({ payload: request })),
    ),
    exportGet: Effect.fn("EngineClient.exportGet")(
      (jobId: Parameters<EngineClientService["exportGet"]>[0]) =>
        normalizeClientFailure(client.export.exportGet({ params: { jobId } })),
    ),
    projectCurrent: normalizeClientFailure(client.project.projectCurrent({})),
    projectOpen: Effect.fn("EngineClient.projectOpen")(
      (request: Parameters<EngineClientService["projectOpen"]>[0]) =>
        normalizeClientFailure(client.project.projectOpen({ payload: request })),
    ),
    projectSave: Effect.fn("EngineClient.projectSave")(
      (request: Parameters<EngineClientService["projectSave"]>[0]) =>
        normalizeClientFailure(client.project.projectSave({ payload: request })),
    ),
    projectRecents: Effect.fn("EngineClient.projectRecents")(
      (limit: Parameters<EngineClientService["projectRecents"]>[0]) =>
        normalizeClientFailure(client.project.projectRecents({ query: { limit } })),
    ),
  });
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
    Effect.gen(function* () {
      const rawClient = yield* makeRawEngineHttpApiClient(options);
      return EngineClient.of(makeEngineClientService(rawClient));
    }),
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
 * Node-platform-backed layer that launches a scoped native engine process under Bun and provides `EngineClient`.
 *
 * @param options - Native engine process launch options.
 * @returns A scoped layer providing {@link EngineClient}.
 */
export function layerEngineClientBun(
  options?: EngineHttpProcessOptions,
): Layer.Layer<EngineClient, EngineProcessError> {
  return Layer.effect(
    EngineClient,
    Effect.gen(function* () {
      const engineProcess = yield* makeEngineHttpProcess(options);
      const rawClient = yield* makeRawEngineHttpApiClient({
        baseUrl: engineProcess.baseUrl,
        bearerToken: engineProcess.bearerToken,
        requestTimeoutMs: 30_000,
      });
      return EngineClient.of(makeEngineClientService(rawClient));
    }),
  ).pipe(Layer.provide(NodeServices.layer), Layer.provide(NodeHttpClient.layerNodeHttp));
}
