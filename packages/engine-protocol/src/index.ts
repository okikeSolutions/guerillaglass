import { z } from "zod";

export const inputMonitoringStatusSchema = z.enum(["notDetermined", "denied", "authorized"]);

export const autoZoomSettingsSchema = z.object({
  isEnabled: z.boolean(),
  intensity: z.number().min(0).max(1),
  minimumKeyframeInterval: z.number().positive(),
});

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
  })
  .nullable();

export const inputEventSchema = z.object({
  type: z.enum(["cursorMoved", "mouseDown", "mouseUp"]),
  timestamp: z.number().nonnegative(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  button: z.enum(["left", "right", "other"]).optional(),
});

export const inputEventLogSchema = z.object({
  schemaVersion: z.literal(1),
  events: z.array(inputEventSchema),
});

export const pingResultSchema = z.object({
  app: z.string().min(1),
  engineVersion: z.string().min(1),
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
});

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

export const permissionsResultSchema = z.object({
  screenRecordingGranted: z.boolean(),
  microphoneGranted: z.boolean(),
  inputMonitoring: inputMonitoringStatusSchema,
});

export const actionResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const displaySourceSchema = z.object({
  id: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const windowSourceSchema = z.object({
  id: z.number().int().nonnegative(),
  title: z.string(),
  appName: z.string(),
  width: z.number().positive(),
  height: z.number().positive(),
  isOnScreen: z.boolean(),
});

export const sourcesResultSchema = z.object({
  displays: z.array(displaySourceSchema),
  windows: z.array(windowSourceSchema),
});

export const captureHealthSchema = z.enum(["good", "warning", "critical"]);
export const captureHealthReasonSchema = z.enum([
  "engine_error",
  "high_dropped_frame_rate",
  "elevated_dropped_frame_rate",
  "low_microphone_level",
]);

export const defaultCaptureTelemetry = {
  totalFrames: 0,
  droppedFrames: 0,
  droppedFramePercent: 0,
  audioLevelDbfs: null,
  health: "good",
  healthReason: null,
} satisfies {
  totalFrames: number;
  droppedFrames: number;
  droppedFramePercent: number;
  audioLevelDbfs: number | null;
  health: "good" | "warning" | "critical";
  healthReason:
    | "engine_error"
    | "high_dropped_frame_rate"
    | "elevated_dropped_frame_rate"
    | "low_microphone_level"
    | null;
};

export const captureTelemetrySchema = z.object({
  totalFrames: z.number().int().nonnegative(),
  droppedFrames: z.number().int().nonnegative(),
  droppedFramePercent: z.number().nonnegative(),
  audioLevelDbfs: z.number().nullable(),
  health: captureHealthSchema,
  healthReason: captureHealthReasonSchema.nullable(),
});

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

export const exportPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
  fileType: z.enum(["mp4", "mov"]),
});

export const exportInfoResultSchema = z.object({
  presets: z.array(exportPresetSchema),
});

export const exportRunResultSchema = z.object({
  outputURL: z.string().min(1),
});

export const projectStateSchema = z.object({
  projectPath: z.string().nullable(),
  recordingURL: z.string().nullable(),
  eventsURL: z.string().nullable(),
  autoZoom: autoZoomSettingsSchema,
  captureMetadata: captureMetadataSchema,
});

export const projectRecentItemSchema = z.object({
  projectPath: z.string().min(1),
  displayName: z.string().min(1),
  lastOpenedAt: z.string().datetime(),
});

export const projectRecentsResultSchema = z.object({
  items: z.array(projectRecentItemSchema),
});

const requestBaseSchema = z.object({
  id: z.string().min(1),
});

const emptyParamsSchema = z.object({}).passthrough().optional().default({});

export const systemPingRequestSchema = requestBaseSchema.extend({
  method: z.literal("system.ping"),
  params: emptyParamsSchema,
});

export const engineCapabilitiesRequestSchema = requestBaseSchema.extend({
  method: z.literal("engine.capabilities"),
  params: emptyParamsSchema,
});

export const permissionsGetRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.get"),
  params: emptyParamsSchema,
});

export const permissionsRequestScreenRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.requestScreenRecording"),
  params: emptyParamsSchema,
});

export const permissionsRequestMicrophoneRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.requestMicrophone"),
  params: emptyParamsSchema,
});

export const permissionsRequestInputMonitoringRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.requestInputMonitoring"),
  params: emptyParamsSchema,
});

export const permissionsOpenInputSettingsRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.openInputMonitoringSettings"),
  params: emptyParamsSchema,
});

export const sourcesListRequestSchema = requestBaseSchema.extend({
  method: z.literal("sources.list"),
  params: emptyParamsSchema,
});

export const captureStartDisplayRequestSchema = requestBaseSchema.extend({
  method: z.literal("capture.startDisplay"),
  params: z.object({
    enableMic: z.boolean().optional().default(false),
  }),
});

export const captureStartWindowRequestSchema = requestBaseSchema.extend({
  method: z.literal("capture.startWindow"),
  params: z.object({
    windowId: z.number().int().nonnegative(),
    enableMic: z.boolean().optional().default(false),
  }),
});

export const captureStopRequestSchema = requestBaseSchema.extend({
  method: z.literal("capture.stop"),
  params: emptyParamsSchema,
});

export const recordingStartRequestSchema = requestBaseSchema.extend({
  method: z.literal("recording.start"),
  params: z.object({
    trackInputEvents: z.boolean().optional().default(false),
  }),
});

export const recordingStopRequestSchema = requestBaseSchema.extend({
  method: z.literal("recording.stop"),
  params: emptyParamsSchema,
});

export const captureStatusRequestSchema = requestBaseSchema.extend({
  method: z.literal("capture.status"),
  params: emptyParamsSchema,
});

export const exportInfoRequestSchema = requestBaseSchema.extend({
  method: z.literal("export.info"),
  params: emptyParamsSchema,
});

export const exportRunRequestSchema = requestBaseSchema.extend({
  method: z.literal("export.run"),
  params: z.object({
    outputURL: z.string().min(1),
    presetId: z.string().min(1),
    trimStartSeconds: z.number().min(0).optional(),
    trimEndSeconds: z.number().min(0).optional(),
  }),
});

export const projectCurrentRequestSchema = requestBaseSchema.extend({
  method: z.literal("project.current"),
  params: emptyParamsSchema,
});

export const projectOpenRequestSchema = requestBaseSchema.extend({
  method: z.literal("project.open"),
  params: z.object({
    projectPath: z.string().min(1),
  }),
});

export const projectSaveRequestSchema = requestBaseSchema.extend({
  method: z.literal("project.save"),
  params: z.object({
    projectPath: z.string().min(1).optional(),
    autoZoom: autoZoomSettingsSchema.optional(),
  }),
});

export const projectRecentsRequestSchema = requestBaseSchema.extend({
  method: z.literal("project.recents"),
  params: z
    .object({
      limit: z.number().int().positive().max(100).optional(),
    })
    .optional()
    .default({}),
});

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

export const engineErrorCodeSchema = z.enum([
  "invalid_request",
  "invalid_params",
  "unsupported_method",
  "permission_denied",
  "runtime_error",
]);

export const engineErrorSchema = z.object({
  code: engineErrorCodeSchema,
  message: z.string().min(1),
});

export const engineSuccessResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(true),
  result: z.unknown(),
});

export const engineErrorResponseSchema = z.object({
  id: z.string().min(1),
  ok: z.literal(false),
  error: engineErrorSchema,
});

export const engineResponseSchema = z.union([
  engineSuccessResponseSchema,
  engineErrorResponseSchema,
]);

export type EngineRequest = z.infer<typeof engineRequestSchema>;
export type EngineResponse = z.infer<typeof engineResponseSchema>;
export type EngineErrorCode = z.infer<typeof engineErrorCodeSchema>;
export type PingResult = z.infer<typeof pingResultSchema>;
export type CapabilitiesResult = z.infer<typeof capabilitiesResultSchema>;
export type PermissionsResult = z.infer<typeof permissionsResultSchema>;
export type ActionResult = z.infer<typeof actionResultSchema>;
export type SourcesResult = z.infer<typeof sourcesResultSchema>;
export type CaptureHealth = z.infer<typeof captureHealthSchema>;
export type CaptureHealthReason = z.infer<typeof captureHealthReasonSchema>;
export type CaptureTelemetry = z.infer<typeof captureTelemetrySchema>;
export type CaptureStatusResult = z.infer<typeof captureStatusResultSchema>;
export type ExportPreset = z.infer<typeof exportPresetSchema>;
export type ExportInfoResult = z.infer<typeof exportInfoResultSchema>;
export type ExportRunResult = z.infer<typeof exportRunResultSchema>;
export type ProjectState = z.infer<typeof projectStateSchema>;
export type ProjectRecentItem = z.infer<typeof projectRecentItemSchema>;
export type ProjectRecentsResult = z.infer<typeof projectRecentsResultSchema>;
export type AutoZoomSettings = z.infer<typeof autoZoomSettingsSchema>;
export type InputEvent = z.infer<typeof inputEventSchema>;
export type InputEventLog = z.infer<typeof inputEventLogSchema>;

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

export function parseResponse(raw: unknown): EngineResponse {
  return engineResponseSchema.parse(raw);
}
