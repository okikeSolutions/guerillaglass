import { Schema } from "effect";
import {
  NonEmptyString,
  PositiveInt,
  optionalWith,
} from "@guerillaglass/engine/protocol/shared/helpers";

/** Result payload for `system.ping`. */
export const pingResultSchema = Schema.Struct({
  app: NonEmptyString,
  engineVersion: NonEmptyString,
  protocolVersion: NonEmptyString,
  platform: NonEmptyString,
});

const capabilitiesAgentSchema = Schema.Struct({
  preflight: Schema.Boolean,
  run: Schema.Boolean,
  status: Schema.Boolean,
  apply: Schema.Boolean,
  localOnly: optionalWith(Schema.Boolean, { default: () => true }),
  runtimeBudgetMinutes: optionalWith(PositiveInt, { default: () => 10 }),
});

/** Result payload for `engine.capabilities`. */
export const capabilitiesResultSchema = Schema.Struct({
  protocolVersion: NonEmptyString,
  platform: NonEmptyString,
  phase: Schema.Literals(["stub", "foundation", "native"]),
  capture: Schema.Struct({
    display: Schema.Boolean,
    window: Schema.Boolean,
    systemAudio: Schema.Boolean,
    microphone: Schema.Boolean,
  }),
  recording: Schema.Struct({
    inputTracking: Schema.Boolean,
  }),
  export: Schema.Struct({
    presets: Schema.Boolean,
    cutPlan: optionalWith(Schema.Boolean, { default: () => false }),
  }),
  project: Schema.Struct({
    openSave: Schema.Boolean,
  }),
  agent: optionalWith(capabilitiesAgentSchema, {
    default: () => ({
      preflight: false,
      run: false,
      status: false,
      apply: false,
      localOnly: true,
      runtimeBudgetMinutes: 10,
    }),
  }),
});

/** Type alias for PingResult. */
export type PingResult = Schema.Schema.Type<typeof pingResultSchema>;
/** Type alias for CapabilitiesResult. */
export type CapabilitiesResult = Schema.Schema.Type<typeof capabilitiesResultSchema>;
