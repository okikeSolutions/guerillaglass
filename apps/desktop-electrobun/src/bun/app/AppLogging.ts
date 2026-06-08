import { Config, Effect, Layer, Logger, References } from "effect";

const minimumLogLevelLayer = Layer.unwrap(
  Effect.gen(function* () {
    const nodeEnv = yield* Config.string("NODE_ENV").pipe(Config.withDefault("development"));
    const diagnosticsEnabled = yield* Config.boolean("GG_STUDIO_DIAGNOSTICS").pipe(
      Config.withDefault(false),
    );
    if (diagnosticsEnabled || nodeEnv !== "production") {
      return Layer.succeed(References.MinimumLogLevel, "Debug" as const);
    }
    return Layer.succeed(References.MinimumLogLevel, "Warn" as const);
  }),
);

const loggerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const nodeEnv = yield* Config.string("NODE_ENV").pipe(Config.withDefault("development"));
    if (nodeEnv === "production") {
      return Logger.layer([Logger.consoleJson]);
    }
    return Logger.layer([Logger.defaultLogger]);
  }),
);

/** Desktop backend logging policy: structured JSON in production, verbose diagnostics in dev. */
export const layerAppLogging = Layer.mergeAll(loggerLayer, minimumLogLevelLayer);
