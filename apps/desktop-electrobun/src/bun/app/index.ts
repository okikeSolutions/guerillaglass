import { Utils } from "electrobun/bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
import { layerEngineClientBun } from "@guerillaglass/engine-client/service";
import { layerEngineDomainServices } from "@guerillaglass/engine-client/services/domainServices";
import { makeDesktopAppRuntime, type DesktopAppRuntime } from "./AppRuntime";
import { AppConfig } from "./AppConfig";
import {
  desktopDiagnosticsLogPath,
  installEarlyDesktopDiagnostics,
  writeEarlyDesktopDiagnostic,
} from "./AppDiagnostics";
import { DesktopShell } from "../shell/DesktopShell";
import { ProjectSession } from "../session/ProjectSession";
import { layerProjectSession } from "../session/ProjectSessionElectrobun";
import { layerDesktopShellFromConfig } from "../shell/DesktopShellElectrobun";
import { layerDesktopTempDirectory } from "../security/DesktopTempDirectory";
import {
  productionLikeEnvironment,
  validateEngineExecutablePolicy,
} from "../security/EngineExecutablePolicy";

installEarlyDesktopDiagnostics();
writeEarlyDesktopDiagnostic("desktop-bootstrap-early-diagnostics-installed", {
  logPath: desktopDiagnosticsLogPath(),
});

let desktopAppRuntime: DesktopAppRuntime | null = null;

async function disposeDesktopApp() {
  writeEarlyDesktopDiagnostic("desktop-runtime-dispose-start");
  const runtime = desktopAppRuntime;
  desktopAppRuntime = null;
  await runtime?.dispose();
  writeEarlyDesktopDiagnostic("desktop-runtime-dispose-complete");
}

function disposeDesktopAppOnProcessSignal() {
  void disposeDesktopApp().finally(() => {
    Utils.quit();
  });
}

process.once("SIGINT", disposeDesktopAppOnProcessSignal);
process.once("SIGTERM", disposeDesktopAppOnProcessSignal);

const guardedEngineClientLayer = Layer.unwrap(
  Effect.gen(function* () {
    yield* validateEngineExecutablePolicy;
    const config = yield* AppConfig;
    const productionLike = productionLikeEnvironment(config);
    return layerEngineClientBun({
      enginePath: config.enginePath ?? undefined,
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
  writeEarlyDesktopDiagnostic("desktop-runtime-create-start");
  desktopAppRuntime = await makeDesktopAppRuntime({
    desktopShellLayer: layerDesktopShellFromConfig,
    engineDomainServicesLayer: guardedEngineDomainServicesLayer,
    desktopTempDirectoryLayer: layerDesktopTempDirectory.pipe(Layer.provide(BunServices.layer)),
    projectSessionLayer: layerProjectSession.pipe(Layer.provide(BunServices.layer)),
  });

  try {
    writeEarlyDesktopDiagnostic("desktop-runtime-create-complete");
    const runtime = desktopAppRuntime;
    await runtime.runPromise(Effect.logInfo("managed desktop runtime created"));
    await runtime.runPromise(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        yield* Effect.logInfo("desktop config loaded", {
          captureBenchmarkEnabled: config.captureBenchmarkEnabled,
          studioDiagnosticsEnabled: config.studioDiagnosticsEnabled,
          electrobunBuild: config.electrobunBuild,
          enginePath: config.enginePath,
          nodeEnv: config.nodeEnv,
        });
        if (!config.captureBenchmarkEnabled) {
          yield* Effect.logInfo("loading initial project session");
          const session = yield* ProjectSession;
          yield* session.loadInitialProject;
          yield* Effect.logInfo("initial project session loaded");
        }
      }),
    );
    await runtime.runPromise(Effect.logInfo("starting desktop shell"));
    await runtime.runPromise(
      Effect.flatMap(DesktopShell, (shell) =>
        shell.start({
          runtime,
          onClose: disposeDesktopApp,
        }),
      ).pipe(Effect.annotateLogs("phase", "desktop-shell-start")),
    );
    await runtime.runPromise(Effect.logInfo("desktop shell started"));
  } catch (error) {
    writeEarlyDesktopDiagnostic("desktop-bootstrap-failed", { error });
    try {
      await disposeDesktopApp();
    } catch (disposeError) {
      writeEarlyDesktopDiagnostic("desktop-bootstrap-dispose-failed", { disposeError });
    }
    throw error;
  }
}

await bootstrapApp();

writeEarlyDesktopDiagnostic("desktop-bootstrap-complete");
