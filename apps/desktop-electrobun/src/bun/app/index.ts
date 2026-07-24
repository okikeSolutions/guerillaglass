import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Metric } from "effect";
import { layerEngineClientBun } from "@guerillaglass/engine-client/service";
import { layerEngineDomainServices } from "@guerillaglass/engine-client/services/domainServices";
import { makeDesktopAppRuntime, type DesktopAppRuntime } from "./AppRuntime";
import { layerAppLogging, layerDesktopProcessDiagnostics, layerEffectDevTools } from "./AppLogging";
import { AppConfig } from "./AppConfig";
import { resolveDesktopDiagnosticsLogPaths } from "./AppLogPaths";
import { desktopBootstrapDuration } from "./AppMetrics";
import { DesktopShell } from "../shell/DesktopShell";
import { ProjectSession } from "../session/ProjectSession";
import { layerProjectSession } from "../session/ProjectSessionElectrobun";
import { layerDesktopShellFromConfig } from "../shell/DesktopShellElectrobun";
import { DesktopTempDirectory, layerDesktopTempDirectory } from "../security/DesktopTempDirectory";
import {
  productionLikeEnvironment,
  validateEngineExecutablePolicy,
} from "../security/EngineExecutablePolicy";

let desktopAppRuntime: DesktopAppRuntime | null = null;

async function disposeDesktopApp() {
  const runtime = desktopAppRuntime;
  desktopAppRuntime = null;
  await runtime?.dispose();
}

const guardedEngineClientLayer = Layer.unwrap(
  Effect.gen(function* () {
    yield* validateEngineExecutablePolicy;
    const config = yield* AppConfig;
    const desktopTempDirectory = yield* DesktopTempDirectory;
    const productionLike = productionLikeEnvironment(config);
    return layerEngineClientBun({
      cleanupStaleProcesses: true,
      enginePath: config.enginePath ?? undefined,
      env: {
        GG_RECORDING_DIR: desktopTempDirectory.path,
        TMPDIR: desktopTempDirectory.path,
        TEMP: desktopTempDirectory.path,
        TMP: desktopTempDirectory.path,
      },
      trustPolicy: {
        enabled: productionLike,
        expectedSha256: config.engineExpectedSha256,
        rejectSymlinkExecutable: true,
        rejectWorldWritable: config.engineRejectWorldWritable,
        requireCurrentUserOwner: config.engineRequireCurrentUserOwner,
      },
    });
  }),
);

const guardedEngineDomainServicesLayer = layerEngineDomainServices.pipe(
  Layer.provideMerge(guardedEngineClientLayer),
);

async function bootstrapApp() {
  desktopAppRuntime = await makeDesktopAppRuntime({
    desktopShellLayer: layerDesktopShellFromConfig,
    engineDomainServicesLayer: guardedEngineDomainServicesLayer,
    desktopTempDirectoryLayer: layerDesktopTempDirectory.pipe(Layer.provide(NodeServices.layer)),
    projectSessionLayer: layerProjectSession.pipe(Layer.provide(NodeServices.layer)),
  });

  try {
    const runtime = desktopAppRuntime;
    await runtime.runPromise(
      Effect.logInfo("managed desktop runtime created").pipe(
        Effect.annotateLogs({ component: "desktop-runtime" }),
      ),
    );
    await runtime.runPromise(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        yield* Effect.logInfo("desktop config loaded").pipe(
          Effect.annotateLogs({
            captureBenchmarkEnabled: config.captureBenchmarkEnabled,
            electrobunBuild: config.electrobunBuild,
            enginePath: config.enginePath,
            mediaServerDebugLoggingEnabled: config.mediaServerDebugLoggingEnabled,
            nodeEnv: config.nodeEnv,
            studioDiagnosticsEnabled: config.studioDiagnosticsEnabled,
          }),
        );
        if (!config.captureBenchmarkEnabled) {
          yield* Effect.gen(function* () {
            yield* Effect.logInfo("loading initial project session");
            const session = yield* ProjectSession;
            yield* session.loadInitialProject;
            yield* Effect.logInfo("initial project session loaded");
          }).pipe(
            Effect.annotateLogs({ component: "project-session" }),
            Effect.withLogSpan("project-session-load"),
            Effect.withSpan("project-session-load"),
          );
        }
      }),
    );
    await runtime.runPromise(
      Effect.logInfo("starting desktop shell").pipe(
        Effect.annotateLogs({ component: "desktop-shell" }),
      ),
    );
    await runtime.runPromise(
      Effect.flatMap(DesktopShell, (shell) =>
        shell.start({
          runtime,
          onClose: disposeDesktopApp,
        }),
      ).pipe(
        Effect.annotateLogs({ component: "desktop-shell", phase: "desktop-shell-start" }),
        Effect.withLogSpan("desktop-shell-start"),
        Effect.withSpan("desktop-shell-start"),
      ),
    );
    await runtime.runPromise(
      Effect.logInfo("desktop shell started").pipe(
        Effect.annotateLogs({ component: "desktop-shell" }),
      ),
    );
  } catch (error) {
    const runtime = desktopAppRuntime;
    if (runtime) {
      await runtime.runPromise(Effect.logError("desktop bootstrap failed", { error }));
    }
    try {
      await disposeDesktopApp();
    } catch (disposeError) {
      if (runtime) {
        await runtime.runPromise(
          Effect.logError("desktop bootstrap dispose failed", { disposeError }),
        );
      }
    }
    throw error;
  }
}

const disposeDesktopAppEffect = Effect.gen(function* () {
  yield* Effect.logInfo("desktop runtime dispose start");
  yield* Effect.promise(disposeDesktopApp).pipe(
    Effect.catchCause((cause) =>
      Effect.logError("desktop runtime dispose failed", { cause }).pipe(Effect.asVoid),
    ),
  );
  yield* Effect.logInfo("desktop runtime dispose complete");
});

const desktopMainEffect = Effect.scoped(
  Effect.gen(function* () {
    yield* Effect.forkScoped(Layer.launch(layerDesktopProcessDiagnostics));
    const logPaths = yield* resolveDesktopDiagnosticsLogPaths;
    yield* Effect.logInfo("desktop bun runtime root started").pipe(
      Effect.annotateLogs({
        component: "desktop-runtime-root",
        logPath: logPaths[0] ?? null,
        logPaths,
      }),
    );
    yield* Effect.promise(bootstrapApp).pipe(
      Effect.trackDuration(desktopBootstrapDuration),
      Effect.annotateLogs({ component: "desktop-bootstrap" }),
      Effect.withLogSpan("desktop-bootstrap"),
      Effect.withSpan("desktop-bootstrap", {
        attributes: {
          "desktop.runtime": "bun",
          "desktop.shell": "electrobun",
        },
      }),
    );
    yield* Effect.logInfo("desktop bootstrap complete").pipe(
      Effect.annotateLogs({ component: "desktop-runtime-root" }),
    );
    yield* Effect.logInfo("desktop bun runtime root completed bootstrap").pipe(
      Effect.annotateLogs({
        component: "desktop-runtime-root",
        logPath: logPaths[0] ?? null,
        logPaths,
      }),
    );

    return yield* Effect.never;
  }),
).pipe(
  Effect.ensuring(disposeDesktopAppEffect),
  Metric.enableRuntimeMetrics,
  Effect.provide(Layer.mergeAll(NodeServices.layer, layerAppLogging, layerEffectDevTools)),
);

NodeRuntime.runMain(desktopMainEffect);
