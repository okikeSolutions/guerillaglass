import { Schema } from "effect";
import { inputMonitoringStatusSchema } from "../shared/valueObjects";

/**
 * Snapshot of platform permissions required for capture and input monitoring.
 */
export const permissionsResultSchema = Schema.Struct({
  screenRecordingGranted: Schema.Boolean,
  microphoneGranted: Schema.Boolean,
  inputMonitoring: inputMonitoringStatusSchema,
}).annotate({ identifier: "PermissionsResult" });

/**
 * Generic success/failure response for command-style permission actions.
 */
export const actionResultSchema = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ActionResult" });

/**
 * Runtime TypeScript type for permission snapshots.
 */
export type PermissionsResult = Schema.Schema.Type<typeof permissionsResultSchema>;

/**
 * Runtime TypeScript type for command-style action results.
 */
export type ActionResult = Schema.Schema.Type<typeof actionResultSchema>;
