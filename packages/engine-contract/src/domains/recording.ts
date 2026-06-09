import {
  captureStatusResultSchema,
  type CaptureStatusResult,
} from "./capture";

/**
 * Recording lifecycle status; intentionally aliases capture status in v2.
 */
export const recordingStatusResultSchema = captureStatusResultSchema;

/**
 * Runtime TypeScript type for recording status responses.
 */
export type RecordingStatusResult = CaptureStatusResult;
