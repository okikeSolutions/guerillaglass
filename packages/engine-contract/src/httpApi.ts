import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Schema } from "effect";
import {
  agentJobIdSchema,
  exportJobIdSchema,
  exportPresetIdSchema,
  outputUrlSchema,
  projectPathSchema,
} from "./schema-primitives";
import {
  RuntimeBudgetMinutesSchema,
  ProjectRecentsLimitSchema,
  NonEmptyString,
  NonNegativeInt,
  NonNegativeNumber,
} from "./shared/helpers";
import { autoZoomSettingsSchema, timelineDocumentSchema } from "./shared/valueObjects";
import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  transcriptionProviderSchema,
} from "./domains/agent";
import { capturePreviewFrameResultSchema, captureStatusResultSchema } from "./domains/capture";
import { captureFrameRateSchema, sourcesResultSchema } from "./domains/sources";
import { actionResultSchema, permissionsResultSchema } from "./domains/permissions";
import {
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
} from "./domains/export";
import { projectRecentsResultSchema, projectStateSchema } from "./domains/project";
import { capabilitiesResultSchema, pingResultSchema } from "./domains/system";
import {
  EngineAuthMiddleware,
  EngineCommonErrors,
  EngineMutationErrors,
  EngineNotFoundError,
  EngineRuntimeError,
} from "./errors";

export const agentPreflightPayloadSchema = Schema.Struct({
  runtimeBudgetMinutes: Schema.optionalKey(RuntimeBudgetMinutesSchema),
  transcriptionProvider: Schema.optionalKey(transcriptionProviderSchema),
  importedTranscriptPath: Schema.optionalKey(projectPathSchema),
}).annotate({ identifier: "AgentPreflightPayload" });

export const agentRunPayloadSchema = Schema.Struct({
  preflightToken: NonEmptyString,
  runtimeBudgetMinutes: Schema.optionalKey(RuntimeBudgetMinutesSchema),
  transcriptionProvider: Schema.optionalKey(transcriptionProviderSchema),
  importedTranscriptPath: Schema.optionalKey(projectPathSchema),
  force: Schema.optionalKey(Schema.Boolean),
}).annotate({ identifier: "AgentRunPayload" });

export const agentApplyPayloadSchema = Schema.Struct({
  destructiveIntent: Schema.optionalKey(Schema.Boolean),
}).annotate({ identifier: "AgentApplyPayload" });

export const captureStartDisplayPayloadSchema = Schema.Struct({
  displayId: Schema.optionalKey(NonNegativeInt),
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
}).annotate({ identifier: "CaptureStartDisplayPayload" });

export const captureStartCurrentWindowPayloadSchema = Schema.Struct({
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
}).annotate({ identifier: "CaptureStartCurrentWindowPayload" });

export const captureStartWindowPayloadSchema = Schema.Struct({
  windowId: NonNegativeInt,
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
}).annotate({ identifier: "CaptureStartWindowPayload" });

export const recordingStartPayloadSchema = Schema.Struct({
  trackInputEvents: Schema.optionalKey(Schema.Boolean),
}).annotate({ identifier: "RecordingStartPayload" });

export const exportRunPayloadSchema = Schema.Struct({
  outputURL: outputUrlSchema,
  presetId: exportPresetIdSchema,
  trimStartSeconds: Schema.optionalKey(NonNegativeNumber),
  trimEndSeconds: Schema.optionalKey(NonNegativeNumber),
  timeline: Schema.optionalKey(timelineDocumentSchema),
}).annotate({ identifier: "ExportRunPayload" });

export const exportRunCutPlanPayloadSchema = Schema.Struct({
  outputURL: outputUrlSchema,
  presetId: exportPresetIdSchema,
  jobId: agentJobIdSchema,
}).annotate({ identifier: "ExportRunCutPlanPayload" });

export const projectOpenPayloadSchema = Schema.Struct({
  projectPath: projectPathSchema,
}).annotate({ identifier: "ProjectOpenPayload" });

export const projectSavePayloadSchema = Schema.Struct({
  projectPath: Schema.optionalKey(projectPathSchema),
  autoZoom: Schema.optionalKey(autoZoomSettingsSchema),
  timeline: Schema.optionalKey(timelineDocumentSchema),
}).annotate({ identifier: "ProjectSavePayload" });

const SystemGroup = HttpApiGroup.make("system").add(
  HttpApiEndpoint.get("systemPing", "/v1/system/ping", {
    success: pingResultSchema,
    error: EngineRuntimeError,
  }),
  HttpApiEndpoint.get("engineCapabilities", "/v1/engine/capabilities", {
    success: capabilitiesResultSchema,
    error: EngineRuntimeError,
  }),
);

const AgentGroup = HttpApiGroup.make("agent").add(
  HttpApiEndpoint.post("agentPreflight", "/v1/agent/preflight", {
    payload: agentPreflightPayloadSchema,
    success: agentPreflightResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("agentRun", "/v1/agent/runs", {
    payload: agentRunPayloadSchema,
    success: agentRunResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.get("agentStatus", "/v1/agent/runs/:jobId", {
    params: { jobId: agentJobIdSchema },
    success: agentStatusResultSchema,
    error: [...EngineCommonErrors, EngineNotFoundError],
  }),
  HttpApiEndpoint.post("agentApply", "/v1/agent/runs/:jobId/apply", {
    params: { jobId: agentJobIdSchema },
    payload: agentApplyPayloadSchema,
    success: actionResultSchema,
    error: [...EngineMutationErrors, EngineNotFoundError],
  }),
);

const PermissionsGroup = HttpApiGroup.make("permissions").add(
  HttpApiEndpoint.get("permissionsGet", "/v1/permissions", {
    success: permissionsResultSchema,
    error: EngineCommonErrors,
  }),
  HttpApiEndpoint.post(
    "permissionsRequestScreenRecording",
    "/v1/permissions/screen-recording/request",
    {
      success: actionResultSchema,
      error: EngineMutationErrors,
    },
  ),
  HttpApiEndpoint.post("permissionsRequestMicrophone", "/v1/permissions/microphone/request", {
    success: actionResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post(
    "permissionsRequestInputMonitoring",
    "/v1/permissions/input-monitoring/request",
    {
      success: actionResultSchema,
      error: EngineMutationErrors,
    },
  ),
  HttpApiEndpoint.post(
    "permissionsOpenInputMonitoringSettings",
    "/v1/permissions/input-monitoring/open-settings",
    {
      success: actionResultSchema,
      error: EngineMutationErrors,
    },
  ),
);

const SourcesGroup = HttpApiGroup.make("sources").add(
  HttpApiEndpoint.get("sourcesList", "/v1/sources", {
    success: sourcesResultSchema,
    error: EngineCommonErrors,
  }),
);

const CaptureGroup = HttpApiGroup.make("capture").add(
  HttpApiEndpoint.post("captureStartDisplay", "/v1/capture/start-display", {
    payload: captureStartDisplayPayloadSchema,
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("captureStartCurrentWindow", "/v1/capture/start-current-window", {
    payload: captureStartCurrentWindowPayloadSchema,
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("captureStartWindow", "/v1/capture/start-window", {
    payload: captureStartWindowPayloadSchema,
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("captureStop", "/v1/capture/stop", {
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.get("captureStatus", "/v1/capture/status", {
    success: captureStatusResultSchema,
    error: EngineCommonErrors,
  }),
  HttpApiEndpoint.get("capturePreviewFrame", "/v1/capture/preview-frame", {
    success: capturePreviewFrameResultSchema,
    error: EngineCommonErrors,
  }),
);

const RecordingGroup = HttpApiGroup.make("recording").add(
  HttpApiEndpoint.post("recordingStart", "/v1/recording/start", {
    payload: recordingStartPayloadSchema,
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("recordingStop", "/v1/recording/stop", {
    success: captureStatusResultSchema,
    error: EngineMutationErrors,
  }),
);

const ExportGroup = HttpApiGroup.make("export").add(
  HttpApiEndpoint.get("exportInfo", "/v1/export/info", {
    success: exportInfoResultSchema,
    error: EngineCommonErrors,
  }),
  HttpApiEndpoint.post("exportRun", "/v1/exports", {
    payload: exportRunPayloadSchema,
    success: exportRunResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("exportRunCutPlan", "/v1/exports/from-cut-plan", {
    payload: exportRunCutPlanPayloadSchema,
    success: exportRunCutPlanResultSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.get("exportGet", "/v1/exports/:jobId", {
    params: { jobId: exportJobIdSchema },
    success: exportRunResultSchema,
    error: [...EngineCommonErrors, EngineNotFoundError],
  }),
);

const ProjectGroup = HttpApiGroup.make("project").add(
  HttpApiEndpoint.get("projectCurrent", "/v1/project/current", {
    success: projectStateSchema,
    error: EngineCommonErrors,
  }),
  HttpApiEndpoint.post("projectOpen", "/v1/project/open", {
    payload: projectOpenPayloadSchema,
    success: projectStateSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.post("projectSave", "/v1/project/save", {
    payload: projectSavePayloadSchema,
    success: projectStateSchema,
    error: EngineMutationErrors,
  }),
  HttpApiEndpoint.get("projectRecents", "/v1/project/recents", {
    query: { limit: Schema.optionalKey(ProjectRecentsLimitSchema) },
    success: projectRecentsResultSchema,
    error: EngineCommonErrors,
  }),
);

/**
 * Complete Effect HttpApi contract for the native engine v2 HTTP surface.
 *
 * @remarks
 * This is the TypeScript source of truth for generated OpenAPI and native bindings.
 * All endpoints require {@link EngineAuthMiddleware} and intentionally model stream-era
 * APIs as polling endpoints for the first v2 migration phase.
 */
export const EngineHttpApi = HttpApi.make("EngineHttpApi")
  .add(
    SystemGroup,
    AgentGroup,
    PermissionsGroup,
    SourcesGroup,
    CaptureGroup,
    RecordingGroup,
    ExportGroup,
    ProjectGroup,
  )
  .middleware(EngineAuthMiddleware);
