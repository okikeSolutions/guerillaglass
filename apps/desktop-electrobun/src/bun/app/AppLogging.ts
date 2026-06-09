import { Config, Duration, Effect, Layer, Logger, Option, References } from "effect";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { desktopDiagnosticsLogPath } from "./AppDiagnostics";

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
    const fileLogEnabled = yield* Config.boolean("GG_DESKTOP_FILE_LOG").pipe(
      Config.withDefault(true),
    );
    const configuredLogPath = yield* Config.option(Config.string("GG_DESKTOP_DIAGNOSTICS_LOG"));
    const logPath = Option.getOrElse(configuredLogPath, () => desktopDiagnosticsLogPath());

    const consoleLogger = nodeEnv === "production" ? Logger.consoleJson : Logger.consolePretty();
    if (!fileLogEnabled || !logPath) {
      return Logger.layer([consoleLogger]);
    }

    const fileLogger = Logger.formatJson.pipe(
      Logger.toFile(logPath, {
        flag: "a",
        batchWindow: Duration.millis(100),
      }),
      Effect.catchCause((cause) =>
        Effect.logWarning("Desktop file logger unavailable; continuing with console logging", {
          cause,
        }).pipe(Effect.as(Logger.consoleJson)),
      ),
    );

    return Logger.layer([consoleLogger, fileLogger]).pipe(Layer.provide(BunFileSystem.layer));
  }),
);

/** Desktop backend logging policy: structured JSON in production, verbose diagnostics in dev. */
export const layerAppLogging = Layer.mergeAll(loggerLayer, minimumLogLevelLayer);
