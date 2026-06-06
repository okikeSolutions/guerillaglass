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

type EngineClientLike = {
  startEffect?: () => Effect.Effect<void, Error>;
  start?: () => Promise<void>;
  stopEffect?: () => Effect.Effect<void, never>;
  stop?: () => Promise<void>;
  pingEffect?: () => Effect.Effect<PingResult, EngineTransportError>;
  ping?: () => Promise<PingResult>;
  getPermissionsEffect?: () => Effect.Effect<PermissionsResult, EngineTransportError>;
  getPermissions?: () => Promise<PermissionsResult>;
  agentPreflightEffect?: (params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) => Effect.Effect<AgentPreflightResult, EngineTransportError>;
  agentPreflight?: (params?: {
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
  }) => Promise<AgentPreflightResult>;
  agentRunEffect?: (params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }) => Effect.Effect<AgentRunResult, EngineTransportError>;
  agentRun?: (params: {
    preflightToken: string;
    runtimeBudgetMinutes?: number;
    transcriptionProvider?: TranscriptionProvider;
    importedTranscriptPath?: string;
    force?: boolean;
  }) => Promise<AgentRunResult>;
  agentStatusEffect?: (jobId: string) => Effect.Effect<AgentStatusResult, EngineTransportError>;
  agentStatus?: (jobId: string) => Promise<AgentStatusResult>;
  agentApplyEffect?: (params: {
    jobId: string;
    destructiveIntent?: boolean;
  }) => Effect.Effect<ActionResult, EngineTransportError>;
  agentApply?: (params: { jobId: string; destructiveIntent?: boolean }) => Promise<ActionResult>;
  requestScreenRecordingPermissionEffect?: () => Effect.Effect<ActionResult, EngineTransportError>;
  requestScreenRecordingPermission?: () => Promise<ActionResult>;
  requestMicrophonePermissionEffect?: () => Effect.Effect<ActionResult, EngineTransportError>;
  requestMicrophonePermission?: () => Promise<ActionResult>;
  requestInputMonitoringPermissionEffect?: () => Effect.Effect<ActionResult, EngineTransportError>;
  requestInputMonitoringPermission?: () => Promise<ActionResult>;
  openInputMonitoringSettingsEffect?: () => Effect.Effect<ActionResult, EngineTransportError>;
  openInputMonitoringSettings?: () => Promise<ActionResult>;
  listSourcesEffect?: () => Effect.Effect<SourcesResult, EngineTransportError>;
  listSources?: () => Promise<SourcesResult>;
  startDisplayCaptureEffect?: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    displayId?: number,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startDisplayCapture?: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    displayId?: number,
    enablePreview?: boolean,
  ) => Promise<CaptureStatusResult>;
  startCurrentWindowCaptureEffect?: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startCurrentWindowCapture?: (
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Promise<CaptureStatusResult>;
  startWindowCaptureEffect?: (
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startWindowCapture?: (
    windowId: number,
    enableMic: boolean,
    captureFps: CaptureFrameRate,
    enablePreview?: boolean,
  ) => Promise<CaptureStatusResult>;
  stopCaptureEffect?: () => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  stopCapture?: () => Promise<CaptureStatusResult>;
  startRecordingEffect?: (
    trackInputEvents: boolean,
  ) => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  startRecording?: (trackInputEvents: boolean) => Promise<CaptureStatusResult>;
  stopRecordingEffect?: () => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  stopRecording?: () => Promise<CaptureStatusResult>;
  captureStatusEffect?: () => Effect.Effect<CaptureStatusResult, EngineTransportError>;
  captureStatus?: () => Promise<CaptureStatusResult>;
  capturePreviewFrameEffect?: () => Effect.Effect<CapturePreviewFrameResult, EngineTransportError>;
  capturePreviewFrame?: () => Promise<CapturePreviewFrameResult>;
  exportInfoEffect?: () => Effect.Effect<ExportInfoResult, EngineTransportError>;
  exportInfo?: () => Promise<ExportInfoResult>;
  runExportEffect?: (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    timeline?: TimelineDocument;
  }) => Effect.Effect<ExportRunResult, EngineTransportError>;
  runExport?: (params: {
    outputURL: string;
    presetId: string;
    trimStartSeconds?: number;
    trimEndSeconds?: number;
    timeline?: TimelineDocument;
  }) => Promise<ExportRunResult>;
  runCutPlanExportEffect?: (params: {
    outputURL: string;
    presetId: string;
    jobId: string;
  }) => Effect.Effect<ExportRunCutPlanResult, EngineTransportError>;
  runCutPlanExport?: (params: {
    outputURL: string;
    presetId: string;
    jobId: string;
  }) => Promise<ExportRunCutPlanResult>;
  projectCurrentEffect?: () => Effect.Effect<ProjectState, EngineTransportError>;
  projectCurrent?: () => Promise<ProjectState>;
  projectOpenEffect?: (projectPath: string) => Effect.Effect<ProjectState, EngineTransportError>;
  projectOpen?: (projectPath: string) => Promise<ProjectState>;
  projectSaveEffect?: (params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
    timeline?: TimelineDocument;
  }) => Effect.Effect<ProjectState, EngineTransportError>;
  projectSave?: (params: {
    projectPath?: string;
    autoZoom?: AutoZoomSettings;
    timeline?: TimelineDocument;
  }) => Promise<ProjectState>;
  projectRecentsEffect?: (
    limit?: number,
  ) => Effect.Effect<ProjectRecentsResult, EngineTransportError>;
  projectRecents?: (limit?: number) => Promise<ProjectRecentsResult>;
};

/** Effect service tag for engine operations used by the Bun host. */
export class EngineTransport extends Context.Service<EngineTransport, EngineTransportService>()(
  "@guerillaglass/desktop/EngineTransport",
) {}

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
  if (!client.start) {
    return Effect.fail(
      new EngineClientError({
        code: "ENGINE_PROCESS_FAILED",
        description: "Engine client start is not implemented.",
      }),
    );
  }
  const start = client.start;
  return Effect.tryPromise({
    try: () => start(),
    catch: (error) => normalizeEngineLifecycleError("start", error),
  });
}

function stopClientEffect(client: EngineClientLike): Effect.Effect<void, never> {
  if (client.stopEffect) {
    return client.stopEffect();
  }
  if (!client.stop) {
    return Effect.void;
  }
  const stop = client.stop;
  return Effect.catch(
    Effect.tryPromise({
      try: () => stop(),
      catch: (error) => normalizeEngineLifecycleError("stop", error),
    }),
    (error) => Effect.logWarning("Engine transport shutdown failed", error),
  );
}

function wrapClientOperationEffect<A>(
  operation: string,
  effect: (() => Effect.Effect<A, unknown> | undefined) | undefined,
  run: (() => Promise<A>) | undefined,
): Effect.Effect<A, EngineTransportError> {
  const effectProgram = effect?.();
  if (effectProgram) {
    return effectProgram.pipe(
      Effect.mapError((error) => normalizeEngineOperationError(operation, error)),
    );
  }
  if (!run) {
    return Effect.fail(
      new EngineOperationError({
        operation,
        description: `Engine ${operation} is not implemented.`,
      }),
    );
  }
  return Effect.tryPromise({
    try: run,
    catch: (error) => normalizeEngineOperationError(operation, error),
  });
}

/** Wraps an imperative `EngineClient` in the Effect transport interface. */
export function makeEngineTransport(client: EngineClientLike): EngineTransportService {
  const ping = client.ping?.bind(client);
  const getPermissions = client.getPermissions?.bind(client);
  const agentPreflight = client.agentPreflight?.bind(client);
  const agentRun = client.agentRun?.bind(client);
  const agentStatus = client.agentStatus?.bind(client);
  const agentApply = client.agentApply?.bind(client);
  const requestScreenRecordingPermission = client.requestScreenRecordingPermission?.bind(client);
  const requestMicrophonePermission = client.requestMicrophonePermission?.bind(client);
  const requestInputMonitoringPermission = client.requestInputMonitoringPermission?.bind(client);
  const openInputMonitoringSettings = client.openInputMonitoringSettings?.bind(client);
  const listSources = client.listSources?.bind(client);
  const startDisplayCapture = client.startDisplayCapture?.bind(client);
  const startCurrentWindowCapture = client.startCurrentWindowCapture?.bind(client);
  const startWindowCapture = client.startWindowCapture?.bind(client);
  const stopCapture = client.stopCapture?.bind(client);
  const startRecording = client.startRecording?.bind(client);
  const stopRecording = client.stopRecording?.bind(client);
  const captureStatus = client.captureStatus?.bind(client);
  const capturePreviewFrame = client.capturePreviewFrame?.bind(client);
  const exportInfo = client.exportInfo?.bind(client);
  const runExport = client.runExport?.bind(client);
  const runCutPlanExport = client.runCutPlanExport?.bind(client);
  const projectCurrent = client.projectCurrent?.bind(client);
  const projectOpen = client.projectOpen?.bind(client);
  const projectSave = client.projectSave?.bind(client);
  const projectRecents = client.projectRecents?.bind(client);

  return {
    ping: wrapClientOperationEffect("system.ping", client.pingEffect?.bind(client), ping),
    getPermissions: wrapClientOperationEffect(
      "permissions.get",
      client.getPermissionsEffect?.bind(client),
      getPermissions,
    ),
    agentPreflight: (params) =>
      wrapClientOperationEffect(
        "agent.preflight",
        () => client.agentPreflightEffect?.(params),
        agentPreflight ? () => agentPreflight(params) : undefined,
      ),
    agentRun: (params) =>
      wrapClientOperationEffect(
        "agent.run",
        () => client.agentRunEffect?.(params),
        agentRun ? () => agentRun(params) : undefined,
      ),
    agentStatus: (jobId) =>
      wrapClientOperationEffect(
        "agent.status",
        () => client.agentStatusEffect?.(jobId),
        agentStatus ? () => agentStatus(jobId) : undefined,
      ),
    agentApply: (params) =>
      wrapClientOperationEffect(
        "agent.apply",
        () => client.agentApplyEffect?.(params),
        agentApply ? () => agentApply(params) : undefined,
      ),
    requestScreenRecordingPermission: wrapClientOperationEffect(
      "permissions.requestScreenRecording",
      client.requestScreenRecordingPermissionEffect?.bind(client),
      requestScreenRecordingPermission,
    ),
    requestMicrophonePermission: wrapClientOperationEffect(
      "permissions.requestMicrophone",
      client.requestMicrophonePermissionEffect?.bind(client),
      requestMicrophonePermission,
    ),
    requestInputMonitoringPermission: wrapClientOperationEffect(
      "permissions.requestInputMonitoring",
      client.requestInputMonitoringPermissionEffect?.bind(client),
      requestInputMonitoringPermission,
    ),
    openInputMonitoringSettings: wrapClientOperationEffect(
      "permissions.openInputMonitoringSettings",
      client.openInputMonitoringSettingsEffect?.bind(client),
      openInputMonitoringSettings,
    ),
    listSources: wrapClientOperationEffect(
      "sources.list",
      client.listSourcesEffect?.bind(client),
      listSources,
    ),
    startDisplayCapture: (enableMic, captureFps, displayId, enablePreview) =>
      wrapClientOperationEffect(
        "capture.startDisplay",
        () => client.startDisplayCaptureEffect?.(enableMic, captureFps, displayId, enablePreview),
        startDisplayCapture
          ? () => startDisplayCapture(enableMic, captureFps, displayId, enablePreview)
          : undefined,
      ),
    startCurrentWindowCapture: (enableMic, captureFps, enablePreview) =>
      wrapClientOperationEffect(
        "capture.startCurrentWindow",
        () => client.startCurrentWindowCaptureEffect?.(enableMic, captureFps, enablePreview),
        startCurrentWindowCapture
          ? () => startCurrentWindowCapture(enableMic, captureFps, enablePreview)
          : undefined,
      ),
    startWindowCapture: (windowId, enableMic, captureFps, enablePreview) =>
      wrapClientOperationEffect(
        "capture.startWindow",
        () => client.startWindowCaptureEffect?.(windowId, enableMic, captureFps, enablePreview),
        startWindowCapture
          ? () => startWindowCapture(windowId, enableMic, captureFps, enablePreview)
          : undefined,
      ),
    stopCapture: wrapClientOperationEffect(
      "capture.stop",
      client.stopCaptureEffect?.bind(client),
      stopCapture,
    ),
    startRecording: (trackInputEvents) =>
      wrapClientOperationEffect(
        "recording.start",
        () => client.startRecordingEffect?.(trackInputEvents),
        startRecording ? () => startRecording(trackInputEvents) : undefined,
      ),
    stopRecording: wrapClientOperationEffect(
      "recording.stop",
      client.stopRecordingEffect?.bind(client),
      stopRecording,
    ),
    captureStatus: wrapClientOperationEffect(
      "capture.status",
      client.captureStatusEffect?.bind(client),
      captureStatus,
    ),
    capturePreviewFrame: wrapClientOperationEffect(
      "capture.previewFrame",
      client.capturePreviewFrameEffect?.bind(client),
      capturePreviewFrame,
    ),
    exportInfo: wrapClientOperationEffect(
      "export.info",
      client.exportInfoEffect?.bind(client),
      exportInfo,
    ),
    runExport: (params) =>
      wrapClientOperationEffect(
        "export.run",
        () => client.runExportEffect?.(params),
        runExport ? () => runExport(params) : undefined,
      ),
    runCutPlanExport: (params) =>
      wrapClientOperationEffect(
        "export.runCutPlan",
        () => client.runCutPlanExportEffect?.(params),
        runCutPlanExport ? () => runCutPlanExport(params) : undefined,
      ),
    projectCurrent: wrapClientOperationEffect(
      "project.current",
      client.projectCurrentEffect?.bind(client),
      projectCurrent,
    ),
    projectOpen: (projectPath) =>
      wrapClientOperationEffect(
        "project.open",
        () => client.projectOpenEffect?.(projectPath),
        projectOpen ? () => projectOpen(projectPath) : undefined,
      ),
    projectSave: (params) =>
      wrapClientOperationEffect(
        "project.save",
        () => client.projectSaveEffect?.(params),
        projectSave ? () => projectSave(params) : undefined,
      ),
    projectRecents: (limit) =>
      wrapClientOperationEffect(
        "project.recents",
        () => client.projectRecentsEffect?.(limit),
        projectRecents ? () => projectRecents(limit) : undefined,
      ),
  };
}

/** Builds the scoped live engine transport layer and owns client startup and shutdown. */
export function makeEngineTransportLive(options?: { createClient?: () => EngineClientLike }) {
  const createClient = options?.createClient ?? (() => new EngineClient());
  return Layer.effect(
    EngineTransport,
    Effect.acquireRelease(Effect.sync(createClient).pipe(Effect.tap(startClientEffect)), (client) =>
      stopClientEffect(client),
    ).pipe(Effect.map(makeEngineTransport)),
  );
}

/** Default live engine transport layer used by the desktop Bun host runtime. */
export const EngineTransportLive = makeEngineTransportLive();
