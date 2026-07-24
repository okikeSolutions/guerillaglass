import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Duration, Effect, Layer, Logger, Metric, References } from "effect";
import { DevTools } from "effect/unstable/devtools";
import { platform, release } from "node:os";
import { resolveDesktopDiagnosticsLogPaths } from "./AppLogPaths";
import {
  desktopProcessExternalBytes,
  desktopProcessHeapTotalBytes,
  desktopProcessHeapUsedBytes,
  desktopProcessMemoryRssBytes,
} from "./AppMetrics";

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({
      cause: value.cause,
      message: value.message,
      name: value.name,
      stack: value.stack,
    });
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const minimumLogLevelLayer = Layer.unwrap(
  Effect.gen(function* () {
    const nodeEnv = yield* Config.string("NODE_ENV").pipe(Config.withDefault("development"));
    const ggDebugEnabled = yield* Config.boolean("GG_DEBUG").pipe(Config.withDefault(false));
    const diagnosticsEnabled = yield* Config.boolean("GG_STUDIO_DIAGNOSTICS").pipe(
      Config.withDefault(false),
    );
    if (ggDebugEnabled || diagnosticsEnabled || nodeEnv !== "production") {
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
    const consoleLogger = nodeEnv === "production" ? Logger.consoleJson : Logger.consolePretty();
    if (!fileLogEnabled) {
      return Logger.layer([consoleLogger]);
    }

    const fileLoggers = (yield* resolveDesktopDiagnosticsLogPaths).map((logPath) =>
      Logger.formatJson.pipe(
        Logger.toFile(logPath, {
          flag: "a",
          batchWindow: Duration.millis(100),
        }),
        Effect.catchCause((cause) =>
          Effect.logWarning("Desktop file logger unavailable; continuing with console logging", {
            cause,
            logPath,
          }).pipe(Effect.as(Logger.consoleJson)),
        ),
      ),
    );

    return Logger.layer([consoleLogger, ...fileLoggers]).pipe(Layer.provide(NodeServices.layer));
  }).pipe(Effect.provide(NodeServices.layer)),
);

/** Desktop backend logging policy: structured JSON in production, verbose diagnostics in dev. */
export const layerAppLogging = Layer.mergeAll(loggerLayer, minimumLogLevelLayer);

export const layerEffectDevTools =
  process.env.GG_EFFECT_DEVTOOLS === "1"
    ? DevTools.layer(process.env.GG_EFFECT_DEVTOOLS_URL?.trim() || undefined)
    : Layer.empty;

/** Process diagnostics installed inside the Effect/Bun runtime and backed by app loggers. */
export const layerDesktopProcessDiagnostics = Layer.effectDiscard(
  Effect.gen(function* () {
    const context = yield* Effect.context<never>();
    const logPaths = yield* resolveDesktopDiagnosticsLogPaths;

    const runDiagnosticLog = <A, E>(effect: Effect.Effect<A, E, never>) => {
      Effect.runForkWith(context)(effect);
    };

    const onUncaughtExceptionMonitor = (error: Error, origin: NodeJS.UncaughtExceptionOrigin) => {
      runDiagnosticLog(
        Effect.logError("uncaught exception monitor").pipe(
          Effect.annotateLogs({
            component: "desktop-process",
            error: safeSerialize(error),
            origin,
          }),
        ),
      );
    };
    const onUnhandledRejection = (reason: unknown) => {
      runDiagnosticLog(
        Effect.logError("unhandled rejection").pipe(
          Effect.annotateLogs({ component: "desktop-process", reason: safeSerialize(reason) }),
        ),
      );
    };
    const onRejectionHandled = () => {
      runDiagnosticLog(
        Effect.logWarning("rejection handled").pipe(
          Effect.annotateLogs({ component: "desktop-process" }),
        ),
      );
    };
    const onWarning = (warning: Error) => {
      runDiagnosticLog(
        Effect.logWarning("process warning").pipe(
          Effect.annotateLogs({ component: "desktop-process", warning: safeSerialize(warning) }),
        ),
      );
    };
    const onBeforeExit = (code: number) => {
      runDiagnosticLog(
        Effect.logInfo("before exit").pipe(
          Effect.annotateLogs({ code, component: "desktop-process" }),
        ),
      );
    };
    const onExit = (code: number) => {
      runDiagnosticLog(
        Effect.logInfo("exit").pipe(Effect.annotateLogs({ code, component: "desktop-process" })),
      );
    };

    process.on("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);
    process.on("unhandledRejection", onUnhandledRejection);
    process.on("rejectionHandled", onRejectionHandled);
    process.on("warning", onWarning);
    process.on("beforeExit", onBeforeExit);
    process.on("exit", onExit);

    const heartbeat = setInterval(() => {
      const memoryUsage = process.memoryUsage();
      runDiagnosticLog(
        Effect.all(
          [
            Metric.update(desktopProcessMemoryRssBytes, memoryUsage.rss),
            Metric.update(desktopProcessHeapUsedBytes, memoryUsage.heapUsed),
            Metric.update(desktopProcessHeapTotalBytes, memoryUsage.heapTotal),
            Metric.update(desktopProcessExternalBytes, memoryUsage.external),
            Effect.logDebug("desktop process heartbeat").pipe(
              Effect.annotateLogs({
                component: "desktop-process",
                memoryUsage,
                resourceUsage:
                  typeof process.resourceUsage === "function" ? process.resourceUsage() : undefined,
                uptimeSeconds: process.uptime(),
              }),
            ),
          ],
          { discard: true },
        ),
      );
    }, 60_000);
    heartbeat.unref?.();

    yield* Effect.logInfo("desktop process diagnostics installed").pipe(
      Effect.annotateLogs({
        argv: process.argv,
        component: "desktop-process",
        cwd: process.cwd(),
        electrobunBuild: process.env.ELECTROBUN_BUILD ?? null,
        execPath: process.execPath,
        ggDebug: process.env.GG_DEBUG ?? null,
        ggEnginePath: process.env.GG_ENGINE_PATH ?? null,
        ggMediaServerDebug: process.env.GG_MEDIA_SERVER_DEBUG ?? null,
        ggStudioDiagnostics: process.env.GG_STUDIO_DIAGNOSTICS ?? null,
        logPath: logPaths[0] ?? null,
        logPaths,
        nodeEnv: process.env.NODE_ENV ?? null,
        osRelease: release(),
        platform: platform(),
      }),
    );

    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        clearInterval(heartbeat);
        process.removeListener("uncaughtExceptionMonitor", onUncaughtExceptionMonitor);
        process.removeListener("unhandledRejection", onUnhandledRejection);
        process.removeListener("rejectionHandled", onRejectionHandled);
        process.removeListener("warning", onWarning);
        process.removeListener("beforeExit", onBeforeExit);
        process.removeListener("exit", onExit);
      }),
    );
  }).pipe(Effect.provide(NodeServices.layer)),
);
