import { Utils } from "electrobun/bun";
import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
import { layerEngineClientBun } from "@guerillaglass/engine-client/service";
import { makeDesktopAppRuntime, type DesktopAppRuntime } from "./AppRuntime";
import { AppConfig } from "./AppConfig";
import { DesktopShell } from "../shell/DesktopShell";
import { ProjectSession } from "../session/ProjectSession";
import { layerProjectSession } from "../session/ProjectSessionElectrobun";
import { layerDesktopShellFromConfig } from "../shell/DesktopShellElectrobun";
import { layerDesktopTempDirectory } from "../security/DesktopTempDirectory";
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

async function bootstrapApp() {
  desktopAppRuntime = await makeDesktopAppRuntime({
    desktopShellLayer: layerDesktopShellFromConfig,
    engineClientLayer: guardedEngineClientLayer,
    desktopTempDirectoryLayer: layerDesktopTempDirectory.pipe(Layer.provide(BunServices.layer)),
    projectSessionLayer: layerProjectSession.pipe(Layer.provide(BunServices.layer)),
  });

  try {
    const runtime = desktopAppRuntime;
    await runtime.runPromise(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        if (!config.captureBenchmarkEnabled) {
          const session = yield* ProjectSession;
          yield* session.loadInitialProject;
        }
      }),
    );
    await runtime.runPromise(
      Effect.flatMap(DesktopShell, (shell) =>
        shell.start({
          runtime,
          onClose: disposeDesktopApp,
        }),
      ),
    );
  } catch (error) {
    try {
      await disposeDesktopApp();
    } catch (disposeError) {
      console.warn("Failed to dispose desktop app runtime after bootstrap failure", disposeError);
    }
    throw error;
  }
}

await bootstrapApp();

console.log("Guerillaglass Electrobun shell started");
