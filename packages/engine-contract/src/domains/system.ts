import { Schema } from "effect";
import { NonEmptyString, PositiveInt } from "../shared/helpers";
import { transcriptionProviderSchema } from "./agent";

/**
 * Health-check response containing engine identity and protocol information.
 */
export const pingResultSchema = Schema.Struct({
  app: NonEmptyString,
  engineVersion: NonEmptyString,
  protocolVersion: NonEmptyString,
  platform: NonEmptyString,
}).annotate({ identifier: "PingResult" });

const capabilitiesAgentSchema = Schema.Struct({
  preflight: Schema.Boolean,
  run: Schema.Boolean,
  status: Schema.Boolean,
  apply: Schema.Boolean,
  localOnly: Schema.optionalKey(Schema.Boolean),
  runtimeBudgetMinutes: Schema.optionalKey(PositiveInt),
  supportedTranscriptionProviders: Schema.optionalKey(Schema.Array(transcriptionProviderSchema)),
  maxSourceDurationSeconds: Schema.optionalKey(PositiveInt),
  preflightTokenTtlSeconds: Schema.optionalKey(PositiveInt),
  artifactVersion: Schema.optionalKey(PositiveInt),
  cutPlanVersion: Schema.optionalKey(PositiveInt),
}).annotate({ identifier: "CapabilitiesAgent" });

/**
 * Feature matrix describing which v2 engine capabilities are implemented.
 */
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
    cutPlan: Schema.optionalKey(Schema.Boolean),
    backgroundFraming: Schema.optionalKey(Schema.Boolean),
  }),
  project: Schema.Struct({
    openSave: Schema.Boolean,
  }),
  agent: Schema.optionalKey(capabilitiesAgentSchema),
}).annotate({ identifier: "CapabilitiesResult" });

/**
 * Runtime TypeScript type for engine health-check responses.
 */
export type PingResult = Schema.Schema.Type<typeof pingResultSchema>;

/**
 * Runtime TypeScript type for engine capability responses.
 */
export type CapabilitiesResult = Schema.Schema.Type<typeof capabilitiesResultSchema>;
