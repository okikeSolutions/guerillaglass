import { Schema } from "effect";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
  NonEmptyString,
  NonNegativeInt,
  NonNegativeNumber,
  ProjectRecentsLimitSchema,
  RuntimeBudgetMinutesSchema,
} from "@guerillaglass/engine/protocol/shared/helpers";
import {
  exportPresetIdSchema,
  outputUrlSchema,
  projectPathSchema,
} from "@guerillaglass/engine/protocol/schema-primitives";
import {
  agentPreflightResultSchema,
  agentRunResultSchema,
  agentStatusResultSchema,
  transcriptionProviderSchema,
} from "@guerillaglass/engine/protocol/domains/agent";
import {
  capturePreviewFrameResultSchema,
  captureStatusResultSchema,
} from "@guerillaglass/engine/protocol/domains/capture";
import {
  captureFrameRateSchema,
  sourcesResultSchema,
} from "@guerillaglass/engine/protocol/domains/sources";
import {
  actionResultSchema,
  permissionsResultSchema,
} from "@guerillaglass/engine/protocol/domains/permissions";
import {
  exportInfoResultSchema,
  exportRunCutPlanResultSchema,
  exportRunResultSchema,
} from "@guerillaglass/engine/protocol/domains/export";
import {
  projectRecentsResultSchema,
  projectStateSchema,
} from "@guerillaglass/engine/protocol/domains/project";
import {
  capabilitiesResultSchema,
  pingResultSchema,
} from "@guerillaglass/engine/protocol/domains/system";
import {
  autoZoomSettingsSchema,
  timelineDocumentSchema,
} from "@guerillaglass/engine/protocol/shared/valueObjects";
import { engineRpcErrorSchema } from "@guerillaglass/engine/protocol/rpc/errors";

const emptyPayload = Schema.Void;

const agentPreflightPayload = Schema.Struct({
  runtimeBudgetMinutes: Schema.optionalKey(RuntimeBudgetMinutesSchema),
  transcriptionProvider: Schema.optionalKey(transcriptionProviderSchema),
  importedTranscriptPath: Schema.optionalKey(projectPathSchema),
});

const agentRunPayload = Schema.Struct({
  preflightToken: NonEmptyString,
  runtimeBudgetMinutes: Schema.optionalKey(RuntimeBudgetMinutesSchema),
  transcriptionProvider: Schema.optionalKey(transcriptionProviderSchema),
  importedTranscriptPath: Schema.optionalKey(projectPathSchema),
  force: Schema.optionalKey(Schema.Boolean),
});

const agentStatusPayload = Schema.Struct({ jobId: NonEmptyString });
const agentApplyPayload = Schema.Struct({
  jobId: NonEmptyString,
  destructiveIntent: Schema.optionalKey(Schema.Boolean),
});

const captureStartDisplayPayload = Schema.Struct({
  displayId: Schema.optionalKey(NonNegativeInt),
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
});

const captureStartCurrentWindowPayload = Schema.Struct({
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
});

const captureStartWindowPayload = Schema.Struct({
  windowId: NonNegativeInt,
  enableMic: Schema.optionalKey(Schema.Boolean),
  enablePreview: Schema.optionalKey(Schema.Boolean),
  captureFps: Schema.optionalKey(captureFrameRateSchema),
});

const recordingStartPayload = Schema.Struct({
  trackInputEvents: Schema.optionalKey(Schema.Boolean),
});

const exportRunPayload = Schema.Struct({
  outputURL: outputUrlSchema,
  presetId: exportPresetIdSchema,
  trimStartSeconds: Schema.optionalKey(NonNegativeNumber),
  trimEndSeconds: Schema.optionalKey(NonNegativeNumber),
  timeline: Schema.optionalKey(timelineDocumentSchema),
});

const exportRunCutPlanPayload = Schema.Struct({
  outputURL: outputUrlSchema,
  presetId: exportPresetIdSchema,
  jobId: NonEmptyString,
});

const projectOpenPayload = Schema.Struct({ projectPath: projectPathSchema });
const projectSavePayload = Schema.Struct({
  projectPath: Schema.optionalKey(projectPathSchema),
  autoZoom: Schema.optionalKey(autoZoomSettingsSchema),
  timeline: Schema.optionalKey(timelineDocumentSchema),
});
const projectRecentsPayload = Schema.Struct({
  limit: Schema.optionalKey(ProjectRecentsLimitSchema),
});

function rpc<const Tag extends string, Payload extends Schema.Top, Success extends Schema.Top>(
  tag: Tag,
  payload: Payload,
  success: Success,
) {
  return Rpc.make(tag, { payload, success, error: engineRpcErrorSchema });
}

function streamRpc<
  const Tag extends string,
  Payload extends Schema.Top,
  Success extends Schema.Top,
>(tag: Tag, payload: Payload, success: Success) {
  return Rpc.make(tag, { payload, success, error: engineRpcErrorSchema, stream: true });
}

export class SystemPing extends rpc("system.ping", emptyPayload, pingResultSchema) {}
export class EngineCapabilities extends rpc(
  "engine.capabilities",
  emptyPayload,
  capabilitiesResultSchema,
) {}
export class AgentPreflight extends rpc(
  "agent.preflight",
  agentPreflightPayload,
  agentPreflightResultSchema,
) {}
export class AgentRun extends rpc("agent.run", agentRunPayload, agentRunResultSchema) {}
export class AgentStatus extends rpc("agent.status", agentStatusPayload, agentStatusResultSchema) {}
export class AgentApply extends rpc("agent.apply", agentApplyPayload, actionResultSchema) {}
export class PermissionsGet extends rpc("permissions.get", emptyPayload, permissionsResultSchema) {}
export class PermissionsRequestScreenRecording extends rpc(
  "permissions.requestScreenRecording",
  emptyPayload,
  actionResultSchema,
) {}
export class PermissionsRequestMicrophone extends rpc(
  "permissions.requestMicrophone",
  emptyPayload,
  actionResultSchema,
) {}
export class PermissionsRequestInputMonitoring extends rpc(
  "permissions.requestInputMonitoring",
  emptyPayload,
  actionResultSchema,
) {}
export class PermissionsOpenInputMonitoringSettings extends rpc(
  "permissions.openInputMonitoringSettings",
  emptyPayload,
  actionResultSchema,
) {}
export class SourcesList extends rpc("sources.list", emptyPayload, sourcesResultSchema) {}
export class CaptureStartDisplay extends rpc(
  "capture.startDisplay",
  captureStartDisplayPayload,
  captureStatusResultSchema,
) {}
export class CaptureStartCurrentWindow extends rpc(
  "capture.startCurrentWindow",
  captureStartCurrentWindowPayload,
  captureStatusResultSchema,
) {}
export class CaptureStartWindow extends rpc(
  "capture.startWindow",
  captureStartWindowPayload,
  captureStatusResultSchema,
) {}
export class CaptureStop extends rpc("capture.stop", emptyPayload, captureStatusResultSchema) {}
export class RecordingStart extends rpc(
  "recording.start",
  recordingStartPayload,
  captureStatusResultSchema,
) {}
export class RecordingStop extends rpc("recording.stop", emptyPayload, captureStatusResultSchema) {}
export class CaptureStatus extends rpc("capture.status", emptyPayload, captureStatusResultSchema) {}
export class CaptureStatusStream extends streamRpc(
  "capture.statusStream",
  emptyPayload,
  captureStatusResultSchema,
) {}
export class CapturePreviewFrame extends rpc(
  "capture.previewFrame",
  emptyPayload,
  capturePreviewFrameResultSchema,
) {}
export class CapturePreviewFrameStream extends streamRpc(
  "capture.previewFrameStream",
  emptyPayload,
  capturePreviewFrameResultSchema,
) {}
export class ExportInfo extends rpc("export.info", emptyPayload, exportInfoResultSchema) {}
export class ExportRun extends rpc("export.run", exportRunPayload, exportRunResultSchema) {}
export class ExportRunCutPlan extends rpc(
  "export.runCutPlan",
  exportRunCutPlanPayload,
  exportRunCutPlanResultSchema,
) {}
export class ProjectCurrent extends rpc("project.current", emptyPayload, projectStateSchema) {}
export class ProjectOpen extends rpc("project.open", projectOpenPayload, projectStateSchema) {}
export class ProjectSave extends rpc("project.save", projectSavePayload, projectStateSchema) {}
export class ProjectRecents extends rpc(
  "project.recents",
  projectRecentsPayload,
  projectRecentsResultSchema,
) {}

/** Effect-native source of truth for all engine RPC procedures. */
export const EngineRpcs = RpcGroup.make(
  SystemPing,
  EngineCapabilities,
  AgentPreflight,
  AgentRun,
  AgentStatus,
  AgentApply,
  PermissionsGet,
  PermissionsRequestScreenRecording,
  PermissionsRequestMicrophone,
  PermissionsRequestInputMonitoring,
  PermissionsOpenInputMonitoringSettings,
  SourcesList,
  CaptureStartDisplay,
  CaptureStartCurrentWindow,
  CaptureStartWindow,
  CaptureStop,
  RecordingStart,
  RecordingStop,
  CaptureStatus,
  CaptureStatusStream,
  CapturePreviewFrame,
  CapturePreviewFrameStream,
  ExportInfo,
  ExportRun,
  ExportRunCutPlan,
  ProjectCurrent,
  ProjectOpen,
  ProjectSave,
  ProjectRecents,
);

export type EngineRpcClient = import("effect/unstable/rpc/RpcClient").FromGroup<
  typeof EngineRpcs,
  import("effect/unstable/rpc/RpcClientError").RpcClientError
>;
