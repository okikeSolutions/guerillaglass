import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "@guerillaglass/engine/protocol/domains/capture";

/** Recording start/stop result schema; recording lifecycle returns capture status. */
export const recordingStatusResultSchema = captureStatusResultSchema;

/** Type alias for recording lifecycle status results. */
export type RecordingStatusResult = CaptureStatusResult;
