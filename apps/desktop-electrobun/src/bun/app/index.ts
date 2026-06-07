import { Utils } from "electrobun/bun";
import { Effect } from "effect";
import { makeDesktopAppRuntime, type DesktopAppRuntime } from "./AppRuntime";
import { DesktopShell } from "../shell/DesktopShell";
import { makeLayerDesktopShell } from "../shell/DesktopShellElectrobun";

const captureBenchmarkEnabled = process.env.GG_CAPTURE_BENCHMARK === "1";
const studioDiagnosticsEnabled = process.env.GG_STUDIO_DIAGNOSTICS === "1";

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

async function bootstrapApp() {
  desktopAppRuntime = await makeDesktopAppRuntime({
    enableCaptureStatusStream: !captureBenchmarkEnabled,
    desktopShellLayer: makeLayerDesktopShell({
      captureBenchmarkEnabled,
      studioDiagnosticsEnabled,
    }),
  });

  try {
    const runtime = desktopAppRuntime;
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
