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
export const PermissionsResult = permissionsResultSchema;
/** Validated PermissionsResult record. */
export interface PermissionsResult extends Schema.Schema.Type<typeof PermissionsResult> {}

/**
 * Runtime TypeScript type for command-style action results.
 */
export const ActionResult = actionResultSchema;
/** Validated ActionResult record. */
export interface ActionResult extends Schema.Schema.Type<typeof ActionResult> {}
