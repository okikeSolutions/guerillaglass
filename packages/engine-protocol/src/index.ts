import { z } from "zod";

export const inputMonitoringStatusSchema = z.enum([
  "notDetermined",
  "denied",
  "authorized",
]);

export const pingResultSchema = z.object({
  app: z.string().min(1),
  engineVersion: z.string().min(1),
  protocolVersion: z.string().min(1),
  platform: z.string().min(1),
});

export const permissionsResultSchema = z.object({
  screenRecordingGranted: z.boolean(),
  microphoneGranted: z.boolean(),
  inputMonitoring: inputMonitoringStatusSchema,
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
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  isOnScreen: z.boolean(),
});

export const sourcesResultSchema = z.object({
  displays: z.array(displaySourceSchema),
  windows: z.array(windowSourceSchema),
});

export const captureStatusResultSchema = z.object({
  isRunning: z.boolean(),
  isRecording: z.boolean(),
  recordingDurationSeconds: z.number().nonnegative(),
  recordingURL: z.string().nullable(),
  lastError: z.string().nullable(),
});

const requestBaseSchema = z.object({
  id: z.string().min(1),
});

const emptyParamsSchema = z.object({}).passthrough().optional().default({});

export const systemPingRequestSchema = requestBaseSchema.extend({
  method: z.literal("system.ping"),
  params: emptyParamsSchema,
});

export const permissionsGetRequestSchema = requestBaseSchema.extend({
  method: z.literal("permissions.get"),
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
  params: emptyParamsSchema,
});

export const recordingStopRequestSchema = requestBaseSchema.extend({
  method: z.literal("recording.stop"),
  params: emptyParamsSchema,
});

export const captureStatusRequestSchema = requestBaseSchema.extend({
  method: z.literal("capture.status"),
  params: emptyParamsSchema,
});

export const engineRequestSchema = z.discriminatedUnion("method", [
  systemPingRequestSchema,
  permissionsGetRequestSchema,
  sourcesListRequestSchema,
  captureStartDisplayRequestSchema,
  captureStartWindowRequestSchema,
  captureStopRequestSchema,
  recordingStartRequestSchema,
  recordingStopRequestSchema,
  captureStatusRequestSchema,
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
export type PermissionsResult = z.infer<typeof permissionsResultSchema>;
export type SourcesResult = z.infer<typeof sourcesResultSchema>;
export type CaptureStatusResult = z.infer<typeof captureStatusResultSchema>;

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
