import { z } from "zod";
import { engineMethods } from "./methods";

/** Input Monitoring permission states returned by the native engine. */
export const inputMonitoringStatusSchema = z.enum(["notDetermined", "denied", "authorized"]);

/** Auto-zoom project settings shared between renderer and native engine. */
export const autoZoomSettingsSchema = z.object({
  isEnabled: z.boolean(),
  intensity: z.number().min(0).max(1),
  minimumKeyframeInterval: z.number().positive(),
});

/** Optional capture metadata embedded in capture status and project state. */
export const captureMetadataSchema = z
  .object({
    window: z
      .object({
        id: z.number().int().nonnegative(),
        title: z.string(),
        appName: z.string(),
      })
      .nullable()
      .optional()
      .default(null),
    source: z.enum(["display", "window"]),
    contentRect: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    }),
    pixelScale: z.number().positive(),
    fps: z.number().positive().nullable().optional(),
  })
  .nullable();

/** Input event payload captured during recording. */
export const inputEventSchema = z.object({
  type: z.enum(["cursorMoved", "mouseDown", "mouseUp"]),
  timestamp: z.number().nonnegative(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  button: z.enum(["left", "right", "other"]).optional(),
});

/** Input event log written by engines that support input tracking. */
export const inputEventLogSchema = z.object({
  schemaVersion: z.literal(1),
  events: z.array(inputEventSchema),
});

/** Result payload for `system.ping`. */
export const pingResultSchema = z.object({
  app: z.string().min(1),
  engineVersion: z.string().min(1),
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
});

/** Result payload for `engine.capabilities`. */
export const capabilitiesResultSchema = z.object({
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
  phase: z.enum(["stub", "foundation", "native"]),
  capture: z.object({
    display: z.boolean(),
    window: z.boolean(),
    systemAudio: z.boolean(),
    microphone: z.boolean(),
  }),
  recording: z.object({
    inputTracking: z.boolean(),
  }),
  export: z.object({
    presets: z.boolean(),
  }),
  project: z.object({
    openSave: z.boolean(),
  }),
});

/** Result payload for `permissions.get`. */
export const permissionsResultSchema = z.object({
  screenRecordingGranted: z.boolean(),
  microphoneGranted: z.boolean(),
  inputMonitoring: inputMonitoringStatusSchema,
});

/** Generic success/failure payload for permission action requests. */
export const actionResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/** Display capture source descriptor. */
export const displaySourceSchema = z.object({
  id: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

/** Window capture source descriptor. */
export const windowSourceSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  appName: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  isOnScreen: z.boolean(),
});

/** Result payload for `sources.list`. */
export const sourcesResultSchema = z.object({
  displays: z.array(displaySourceSchema),
  windows: z.array(windowSourceSchema),
});

/** Health severity for capture telemetry. */
export const captureHealthSchema = z.enum(["good", "warning", "critical"]);
/** Optional reason code associated with non-good telemetry health. */
export const captureHealthReasonSchema = z.enum([
  "engine_error",
  "high_dropped_frame_rate",
  "elevated_dropped_frame_rate",
  "low_microphone_level",
]);
/** Supported capture frame rates for all engines. */
export const captureFrameRates = [24, 30, 60] as const;
/** Default capture frame rate used when request params omit `captureFps`. */
export const defaultCaptureFrameRate: (typeof captureFrameRates)[number] = 30;
const [captureFrameRate24, captureFrameRate30, captureFrameRate60] = captureFrameRates;
/** Zod schema for engine-supported capture FPS values. */
export const captureFrameRateSchema = z.union([
  z.literal(captureFrameRate24),
  z.literal(captureFrameRate30),
  z.literal(captureFrameRate60),
]);

/** Default telemetry object used by older engine responses. */
export const defaultCaptureTelemetry = {
  totalFrames: 0,
  droppedFrames: 0,
  droppedFramePercent: 0,
  sourceDroppedFrames: 0,
  sourceDroppedFramePercent: 0,
  writerDroppedFrames: 0,
  writerBackpressureDrops: 0,
  writerDroppedFramePercent: 0,
  achievedFps: 0,
  audioLevelDbfs: null,
  health: "good",
  healthReason: null,
} satisfies {
  totalFrames: number;
  droppedFrames: number;
  droppedFramePercent: number;
  sourceDroppedFrames: number;
  sourceDroppedFramePercent: number;
  writerDroppedFrames: number;
  writerBackpressureDrops: number;
  writerDroppedFramePercent: number;
  achievedFps: number;
  audioLevelDbfs: number | null;
  health: "good" | "warning" | "critical";
  healthReason:
    | "engine_error"
    | "high_dropped_frame_rate"
    | "elevated_dropped_frame_rate"
    | "low_microphone_level"
    | null;
};

/** Capture telemetry payload returned by `capture.status`. */
export const captureTelemetrySchema = z.object({
  totalFrames: z.number().int().nonnegative(),
  droppedFrames: z.number().int().nonnegative(),
  droppedFramePercent: z.number().nonnegative(),
  sourceDroppedFrames: z.number().int().nonnegative().optional().default(0),
  sourceDroppedFramePercent: z.number().nonnegative().optional().default(0),
  writerDroppedFrames: z.number().int().nonnegative().optional().default(0),
  writerBackpressureDrops: z.number().int().nonnegative().optional().default(0),
  writerDroppedFramePercent: z.number().nonnegative().optional().default(0),
  achievedFps: z.number().nonnegative().optional().default(0),
  audioLevelDbfs: z.number().nullable(),
  health: captureHealthSchema,
  healthReason: captureHealthReasonSchema.nullable(),
});

/** Result payload for capture and recording lifecycle methods. */
export const captureStatusResultSchema = z.object({
  isRunning: z.boolean(),
  isRecording: z.boolean(),
  recordingDurationSeconds: z.number().nonnegative(),
  recordingURL: z.string().nullable(),
  captureMetadata: captureMetadataSchema.optional().default(null),
  lastError: z.string().nullable(),
  eventsURL: z.string().nullable(),
  telemetry: captureTelemetrySchema.optional().default(defaultCaptureTelemetry),
});

/** Export preset descriptor returned by `export.info`. */
export const exportPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  fileType: z.enum(["mp4", "mov"]),
});

/** Result payload for `export.info`. */
export const exportInfoResultSchema = z.object({
  presets: z.array(exportPresetSchema),
});

/** Result payload for `export.run`. */
export const exportRunResultSchema = z.object({
  outputURL: z.string().min(1),
});

/** Engine protocol schema for projectStateSchema. */
export const projectStateSchema = z.object({
  projectPath: z.string().nullable(),
  recordingURL: z.string().nullable(),
  eventsURL: z.string().nullable(),
  autoZoom: autoZoomSettingsSchema,
  captureMetadata: captureMetadataSchema,
});

/** Engine protocol schema for projectRecentItemSchema. */
export const projectRecentItemSchema = z.object({
  projectPath: z.string().min(1),
  displayName: z.string().min(1),
  lastOpenedAt: z.string().datetime(),
});

/** Engine protocol schema for projectRecentsResultSchema. */
export const projectRecentsResultSchema = z.object({
  items: z.array(projectRecentItemSchema),
});

const requestBaseSchema = z.object({
  id: z.string().min(1),
});

const emptyParamsSchema = z.looseObject({}).optional().default({});

/** Engine protocol schema for systemPingRequestSchema. */
export const systemPingRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.SystemPing),
  params: emptyParamsSchema,
});

/** Engine protocol schema for engineCapabilitiesRequestSchema. */
export const engineCapabilitiesRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.EngineCapabilities),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsGetRequestSchema. */
export const permissionsGetRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsGet),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestScreenRequestSchema. */
export const permissionsRequestScreenRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestScreenRecording),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestMicrophoneRequestSchema. */
export const permissionsRequestMicrophoneRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestMicrophone),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsRequestInputMonitoringRequestSchema. */
export const permissionsRequestInputMonitoringRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsRequestInputMonitoring),
  params: emptyParamsSchema,
});

/** Engine protocol schema for permissionsOpenInputSettingsRequestSchema. */
export const permissionsOpenInputSettingsRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.PermissionsOpenInputMonitoringSettings),
  params: emptyParamsSchema,
});

/** Engine protocol schema for sourcesListRequestSchema. */
export const sourcesListRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.SourcesList),
  params: emptyParamsSchema,
});

/** Engine protocol schema for captureStartDisplayRequestSchema. */
export const captureStartDisplayRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartDisplay),
  params: z.object({
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStartCurrentWindowRequestSchema. */
export const captureStartCurrentWindowRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartCurrentWindow),
  params: z.object({
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStartWindowRequestSchema. */
export const captureStartWindowRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStartWindow),
  params: z.object({
    windowId: z.number().int().nonnegative(),
    enableMic: z.boolean().optional().default(false),
    captureFps: captureFrameRateSchema.optional().default(defaultCaptureFrameRate),
  }),
});

/** Engine protocol schema for captureStopRequestSchema. */
export const captureStopRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStop),
  params: emptyParamsSchema,
});

/** Engine protocol schema for recordingStartRequestSchema. */
export const recordingStartRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.RecordingStart),
  params: z.object({
    trackInputEvents: z.boolean().optional().default(false),
  }),
});

/** Engine protocol schema for recordingStopRequestSchema. */
export const recordingStopRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.RecordingStop),
  params: emptyParamsSchema,
});

/** Engine protocol schema for captureStatusRequestSchema. */
export const captureStatusRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.CaptureStatus),
  params: emptyParamsSchema,
});

/** Engine protocol schema for exportInfoRequestSchema. */
export const exportInfoRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ExportInfo),
  params: emptyParamsSchema,
});

/** Engine protocol schema for exportRunRequestSchema. */
export const exportRunRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ExportRun),
  params: z.object({
    outputURL: z.string().min(1),
    presetId: z.string().min(1),
    trimStartSeconds: z.number().min(0).optional(),
    trimEndSeconds: z.number().min(0).optional(),
  }),
});

/** Engine protocol schema for projectCurrentRequestSchema. */
export const projectCurrentRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectCurrent),
  params: emptyParamsSchema,
});

/** Engine protocol schema for projectOpenRequestSchema. */
export const projectOpenRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectOpen),
  params: z.object({
    projectPath: z.string().min(1),
  }),
});

/** Engine protocol schema for projectSaveRequestSchema. */
export const projectSaveRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectSave),
  params: z.object({
    projectPath: z.string().min(1).optional(),
    autoZoom: autoZoomSettingsSchema.optional(),
  }),
});

/** Engine protocol schema for projectRecentsRequestSchema. */
export const projectRecentsRequestSchema = requestBaseSchema.extend({
  method: z.literal(engineMethods.ProjectRecents),
  params: z
    .object({
      limit: z.number().int().positive().max(100).optional(),
    })
    .optional()
    .default({}),
});

/** Discriminated union of all request payloads supported by the engine. */
export const engineRequestSchema = z.discriminatedUnion("method", [
  systemPingRequestSchema,
  engineCapabilitiesRequestSchema,
  permissionsGetRequestSchema,
  permissionsRequestScreenRequestSchema,
  permissionsRequestMicrophoneRequestSchema,
  permissionsRequestInputMonitoringRequestSchema,
  permissionsOpenInputSettingsRequestSchema,
  sourcesListRequestSchema,
  captureStartDisplayRequestSchema,
  captureStartCurrentWindowRequestSchema,
  captureStartWindowRequestSchema,
  captureStopRequestSchema,
  recordingStartRequestSchema,
  recordingStopRequestSchema,
  captureStatusRequestSchema,
  exportInfoRequestSchema,
  exportRunRequestSchema,
  projectCurrentRequestSchema,
  projectOpenRequestSchema,
  projectSaveRequestSchema,
  projectRecentsRequestSchema,
]);

/** Error code values returned on failed engine responses. */
export const engineErrorCodeSchema = z.enum([
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "runtime_error",
]);

/** Error object shape returned by failed engine responses. */
export const engineErrorSchema = z.object({
  code: engineErrorCodeSchema,
  message: z.string().min(1),
});

/** Success response envelope. */
export const engineSuccessResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

/** Error response envelope. */
export const engineErrorResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(false),
  error: engineErrorSchema,
});

/** Union of success and error engine response envelopes. */
export const engineResponseSchema = z.union([
  engineSuccessResponseSchema,
  engineErrorResponseSchema,
]);

/** Type alias for EngineRequest. */
export type EngineRequest = z.infer<typeof engineRequestSchema>;
/** Type alias for EngineResponse. */
export type EngineResponse = z.infer<typeof engineResponseSchema>;
/** Type alias for EngineErrorCode. */
export type EngineErrorCode = z.infer<typeof engineErrorCodeSchema>;
/** Type alias for PingResult. */
export type PingResult = z.infer<typeof pingResultSchema>;
/** Type alias for CapabilitiesResult. */
export type CapabilitiesResult = z.infer<typeof capabilitiesResultSchema>;
/** Type alias for PermissionsResult. */
export type PermissionsResult = z.infer<typeof permissionsResultSchema>;
/** Type alias for ActionResult. */
export type ActionResult = z.infer<typeof actionResultSchema>;
/** Type alias for SourcesResult. */
export type SourcesResult = z.infer<typeof sourcesResultSchema>;
/** Type alias for CaptureHealth. */
export type CaptureHealth = z.infer<typeof captureHealthSchema>;
/** Type alias for CaptureHealthReason. */
export type CaptureHealthReason = z.infer<typeof captureHealthReasonSchema>;
/** Type alias for CaptureFrameRate. */
export type CaptureFrameRate = z.infer<typeof captureFrameRateSchema>;
/** Type alias for CaptureTelemetry. */
export type CaptureTelemetry = z.infer<typeof captureTelemetrySchema>;
/** Type alias for CaptureStatusResult. */
export type CaptureStatusResult = z.infer<typeof captureStatusResultSchema>;
/** Type alias for ExportPreset. */
export type ExportPreset = z.infer<typeof exportPresetSchema>;
/** Type alias for ExportInfoResult. */
export type ExportInfoResult = z.infer<typeof exportInfoResultSchema>;
/** Type alias for ExportRunResult. */
export type ExportRunResult = z.infer<typeof exportRunResultSchema>;
/** Type alias for ProjectState. */
export type ProjectState = z.infer<typeof projectStateSchema>;
/** Type alias for ProjectRecentItem. */
export type ProjectRecentItem = z.infer<typeof projectRecentItemSchema>;
/** Type alias for ProjectRecentsResult. */
export type ProjectRecentsResult = z.infer<typeof projectRecentsResultSchema>;
/** Type alias for AutoZoomSettings. */
export type AutoZoomSettings = z.infer<typeof autoZoomSettingsSchema>;
/** Type alias for InputEvent. */
export type InputEvent = z.infer<typeof inputEventSchema>;
/** Type alias for InputEventLog. */
export type InputEventLog = z.infer<typeof inputEventLogSchema>;

/** Builds and validates a typed engine request payload. */
export function buildRequest<TMethod extends EngineRequest["method"]>(
  method: TMethod,
  params: Extract<EngineRequest, { method: TMethod }>["params"],
  id = crypto.randomUUID(),
): Extract<EngineRequest, { method: TMethod }> {
  return engineRequestSchema.parse({ id, method, params }) as Extract<
    EngineRequest,
    { method: TMethod }
  >;
}

/** Parses and validates an engine response payload. */
export function parseResponse(raw: unknown): EngineResponse {
  return engineResponseSchema.parse(raw);
}
