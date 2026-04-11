import {
  type ActionResult,
  type AgentPreflightResult,
  type AgentRunResult,
  type AgentStatusResult,
  type AutoZoomSettings,
  type CaptureFrameRate,
  type CapturePreviewFrameResult,
  type CaptureStatusResult,
  type ExportInfoResult,
  type ExportRunCutPlanResult,
  type ExportRunResult,
  type PermissionsResult,
  type PingResult,
  type ProjectRecentsResult,
  type ProjectState,
  type SourcesResult,
  type TimelineDocument,
  type TranscriptionProvider,
} from "@guerillaglass/engine-protocol";
import { Context, Effect, Layer } from "effect";
import {
  ContractDecodeError,
  EngineClientError,
  EngineOperationError,
  EngineRequestValidationError,
  EngineResponseError,
  JsonParseError,
  messageFromUnknownError,
} from "../../shared/errors";
import { EngineClient } from "./client";

/** Tagged engine transport failures exposed to Bun host programs. */
export type EngineTransportError =
  | ContractDecodeError
  | EngineClientError
  | EngineOperationError
  | EngineRequestValidationError
  | EngineResponseError
  | JsonParseError;

/** Effect-based host surface for the desktop engine transport. */
export type EngineTransportService = {
  ping: Effect.Effect<PingResult, EngineTransportError>;
  getPermissions: Effect.Effect<PermissionsResult, EngineTransportError>;
  agentPreflight: (params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) => Effect.Effect<AgentPreflightResult, EngineTransportError>;
  agentRun: (params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }) => Effect.Effect<AgentRunResult, EngineTransportError>;
  agentStatus: (jobId: string) => Effect.Effect<AgentStatusResult, EngineTransportError>;
  agentApply: (params: {
    jobId: string;
    destructiveIntent?: boolean;
  }) => Effect.Effect<ActionResult, EngineTransportError>;
  requestScreenRecordingPermission: Effect.Effect<ActionResult, EngineTransportError>;
  requestMicrophonePermission: Effect.Effect<ActionResult, EngineTransportError>;
  requestInputMonitoringPermission: Effect.Effect<ActionResult, EngineTransportError>;
  openInputMonitoringSettings: Effect.Effect<ActionResult, EngineTransportError>;
  listSources: Effect.Effect<SourcesResult, EngineTransportError>;
  startDisplayCapture: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    displayId?: number,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startCurrentWindowCapture: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startWindowCapture: (
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  stopCapture: Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startRecording: (
    trackInputEvents: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  stopRecording: Effect.Effect<CaptureStatusResult, EngineTransportError>;
  captureStatus: Effect.Effect<CaptureStatusResult, EngineTransportError>;
  capturePreviewFrame: Effect.Effect<CapturePreviewFrameResult, EngineTransportError>;
  exportInfo: Effect.Effect<ExportInfoResult, EngineTransportError>;
  runExport: (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    timeline?: TimelineDocument;
  }) => Effect.Effect<ExportRunResult, EngineTransportError>;
  runCutPlanExport: (params: {
    outputURL: string;
    presetId: string;
    jobId: string;
  }) => Effect.Effect<ExportRunCutPlanResult, EngineTransportError>;
  projectCurrent: Effect.Effect<ProjectState, EngineTransportError>;
  projectOpen: (projectPath: string) => Effect.Effect<ProjectState, EngineTransportError>;
  projectSave: (params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
    timeline?: TimelineDocument;
  }) => Effect.Effect<ProjectState, EngineTransportError>;
  projectRecents: (limit?: number) => Effect.Effect<ProjectRecentsResult, EngineTransportError>;
};

type EngineClientLike = Pick<
  EngineClient,
  | "start"
  | "stop"
  | "ping"
  | "getPermissions"
  | "agentPreflight"
  | "agentRun"
  | "agentStatus"
  | "agentApply"
  | "requestScreenRecordingPermission"
  | "requestMicrophonePermission"
  | "requestInputMonitoringPermission"
  | "openInputMonitoringSettings"
  | "listSources"
  | "startDisplayCapture"
  | "startCurrentWindowCapture"
  | "startWindowCapture"
  | "stopCapture"
  | "startRecording"
  | "stopRecording"
  | "captureStatus"
  | "capturePreviewFrame"
  | "exportInfo"
  | "runExport"
  | "runCutPlanExport"
  | "projectCurrent"
  | "projectOpen"
  | "projectSave"
  | "projectRecents"
> & {
  startEffect?: () => Effect.Effect<void, Error>;
  stopEffect?: () => Effect.Effect<void, never>;
};

/** Effect service tag for engine operations used by the Bun host. */
export class EngineTransport extends Context.Tag("@guerillaglass/desktop/EngineTransport")<
  EngineTransport,
  EngineTransportService
>() {}

function isEngineTransportError(error: unknown): error is EngineTransportError {
  return (
    error instanceof ContractDecodeError ||
    error instanceof EngineClientError ||
    error instanceof EngineOperationError ||
    error instanceof EngineRequestValidationError ||
    error instanceof EngineResponseError ||
    error instanceof JsonParseError
  );
}

function normalizeEngineOperationError(operation: string, error: unknown): EngineTransportError {
  if (isEngineTransportError(error)) {
    return error;
  }
  return new EngineOperationError({
    operation,
    description: messageFromUnknownError(error, `Engine ${operation} failed.`),
  });
}

function normalizeEngineLifecycleError(phase: "start" | "stop", error: unknown): EngineClientError {
  if (error instanceof EngineClientError) {
    return error;
  }
  return new EngineClientError({
    code: "ENGINE_PROCESS_FAILED",
    description: messageFromUnknownError(error, `Engine client ${phase} failed.`),
    cause: error,
  });
}

function startClientEffect(client: EngineClientLike): Effect.Effect<void, EngineClientError> {
  if (client.startEffect) {
    return client
      .startEffect()
      .pipe(Effect.mapError((error) => normalizeEngineLifecycleError("start", error)));
  }
  return Effect.tryPromise({
    try: () => client.start(),
    catch: (error) => normalizeEngineLifecycleError("start", error),
  });
}

function stopClientEffect(client: EngineClientLike): Effect.Effect<void, never> {
  if (client.stopEffect) {
    return client.stopEffect();
  }
  return Effect.catchAll(
    Effect.tryPromise({
      try: () => client.stop(),
      catch: (error) => normalizeEngineLifecycleError("stop", error),
    }),
    (error) => Effect.logWarning("Engine transport shutdown failed", error),
  );
}

function wrapClientEffect<A>(
  operation: string,
  run: () => Promise<A>,
): Effect.Effect<A, EngineTransportError> {
  return Effect.tryPromise({
    try: run,
    catch: (error) => normalizeEngineOperationError(operation, error),
  });
}

/** Wraps an imperative `EngineClient` in the Effect transport interface. */
export function makeEngineTransport(client: EngineClientLike): EngineTransportService {
  return {
    ping: wrapClientEffect("system.ping", () => client.ping()),
    getPermissions: wrapClientEffect("permissions.get", () => client.getPermissions()),
    agentPreflight: (params) =>
      wrapClientEffect("agent.preflight", () => client.agentPreflight(params)),
    agentRun: (params) => wrapClientEffect("agent.run", () => client.agentRun(params)),
    agentStatus: (jobId) => wrapClientEffect("agent.status", () => client.agentStatus(jobId)),
    agentApply: (params) => wrapClientEffect("agent.apply", () => client.agentApply(params)),
    requestScreenRecordingPermission: wrapClientEffect("permissions.requestScreenRecording", () =>
      client.requestScreenRecordingPermission(),
    ),
    requestMicrophonePermission: wrapClientEffect("permissions.requestMicrophone", () =>
      client.requestMicrophonePermission(),
    ),
    requestInputMonitoringPermission: wrapClientEffect("permissions.requestInputMonitoring", () =>
      client.requestInputMonitoringPermission(),
    ),
    openInputMonitoringSettings: wrapClientEffect("permissions.openInputMonitoringSettings", () =>
      client.openInputMonitoringSettings(),
    ),
    listSources: wrapClientEffect("sources.list", () => client.listSources()),
    startDisplayCapture: (enableMic, captureFps, displayId, enablePreview) =>
      wrapClientEffect("capture.startDisplay", () =>
        client.startDisplayCapture(enableMic, captureFps, displayId, enablePreview),
      ),
    startCurrentWindowCapture: (enableMic, captureFps, enablePreview) =>
      wrapClientEffect("capture.startCurrentWindow", () =>
        client.startCurrentWindowCapture(enableMic, captureFps, enablePreview),
      ),
    startWindowCapture: (windowId, enableMic, captureFps, enablePreview) =>
      wrapClientEffect("capture.startWindow", () =>
        client.startWindowCapture(windowId, enableMic, captureFps, enablePreview),
      ),
    stopCapture: wrapClientEffect("capture.stop", () => client.stopCapture()),
    startRecording: (trackInputEvents) =>
      wrapClientEffect("recording.start", () => client.startRecording(trackInputEvents)),
    stopRecording: wrapClientEffect("recording.stop", () => client.stopRecording()),
    captureStatus: wrapClientEffect("capture.status", () => client.captureStatus()),
    capturePreviewFrame: wrapClientEffect("capture.previewFrame", () =>
      client.capturePreviewFrame(),
    ),
    exportInfo: wrapClientEffect("export.info", () => client.exportInfo()),
    runExport: (params) => wrapClientEffect("export.run", () => client.runExport(params)),
    runCutPlanExport: (params) =>
      wrapClientEffect("export.runCutPlan", () => client.runCutPlanExport(params)),
    projectCurrent: wrapClientEffect("project.current", () => client.projectCurrent()),
    projectOpen: (projectPath) =>
      wrapClientEffect("project.open", () => client.projectOpen(projectPath)),
    projectSave: (params) => wrapClientEffect("project.save", () => client.projectSave(params)),
    projectRecents: (limit) =>
      wrapClientEffect("project.recents", () => client.projectRecents(limit)),
  };
}

/** Builds the scoped live engine transport layer and owns client startup and shutdown. */
export function makeEngineTransportLive(options?: { createClient?: () => EngineClientLike }) {
  const createClient = options?.createClient ?? (() => new EngineClient());
  return Layer.scoped(
    EngineTransport,
    Effect.acquireRelease(Effect.sync(createClient).pipe(Effect.tap(startClientEffect)), (client) =>
      stopClientEffect(client),
    ).pipe(Effect.map(makeEngineTransport)),
  );
}

/** Default live engine transport layer used by the desktop Bun host runtime. */
export const EngineTransportLive = makeEngineTransportLive();
