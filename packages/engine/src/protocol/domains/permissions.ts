import { Schema } from "effect";
import { inputMonitoringStatusSchema } from "@guerillaglass/engine/protocol/shared/valueObjects";

/** Result payload for `permissions.get`. */
export const permissionsResultSchema = Schema.Struct({
  screenRecordingGranted: Schema.Boolean,
  microphoneGranted: Schema.Boolean,
  inputMonitoring: inputMonitoringStatusSchema,
});

/** Generic success/failure payload for permission action requests. */
export const actionResultSchema = Schema.Struct({
  success: Schema.Boolean,
  message: Schema.optionalKey(Schema.String),
});

/** Type alias for PermissionsResult. */
export type PermissionsResult = Schema.Schema.Type<typeof permissionsResultSchema>;
/** Type alias for ActionResult. */
export type ActionResult = Schema.Schema.Type<typeof actionResultSchema>;
