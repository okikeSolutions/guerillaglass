import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Tray,
  Updater,
  Utils,
} from "electrobun/bun";
import { Effect, Layer, Option, Ref } from "effect";
import type { CaptureStatusResult } from "@guerillaglass/engine-contract/domains/capture";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { AppConfig } from "../app/AppConfig";
import { createEngineBridgeHandlers } from "../bridge/requestHandlers";
import {
  buildMainViewNavigationRules,
  DEFAULT_DEV_SERVER_PORT,
  devServerURL,
} from "../security/DesktopNavigationPolicy";
import { extractMenuAction } from "../menu/actions";
import { buildApplicationMenu, buildLinuxTrayMenu } from "../menu/builders";
import { routeMenuAction } from "../menu/router";
import { captureBenchmarkWindowTitle } from "../../shared/captureBenchmark";
import { appendStudioDiagnosticsQuery } from "../../shared/studioDiagnostics";
import { studioShortcutOverridesEqual } from "../../shared/shortcuts";
import { decodeUnknownWithSchemaSync } from "@guerillaglass/engine-client/schemaContracts";
import {
  hostMenuStateSchema,
  hostReviewEventMessageSchema,
  studioDiagnosticsEntrySchema,
  type DesktopBridgeRPC,
  type DesktopRuntimeFlags,
  type HostMenuCommand,
  type HostMenuState,
  type StudioDiagnosticsEntry,
} from "../../shared/bridge/desktopBridgeContract";
import {
  DesktopShell,
  type DesktopShellLayerOptions,
  type DesktopShellStartOptions,
} from "./DesktopShell";

type BunRPC = ReturnType<typeof BrowserView.defineRPC<DesktopBridgeRPC>>;
type MainWindow = BrowserWindow<BunRPC>;

const maxElectrobunRequestTimeMs = 31 * 60 * 1000;

const initialHostMenuState: HostMenuState = {
  canSave: false,
  canExport: false,
  canTrimTimeline: false,
  canToggleTimeline: true,
  isRecording: false,
  recordingURL: null,
  locale: "en-US",
  densityMode: "comfortable",
  shortcutOverrides: {},
};

function logStudioDiagnostics(entry: StudioDiagnosticsEntry) {
  return Effect.logInfo(entry.message).pipe(
    Effect.annotateLogs({
      ...(entry.annotations ?? {}),
      component: "studio-diagnostics",
      rendererLevel: entry.level,
      rendererSpans: entry.spans ? JSON.stringify(entry.spans) : null,
      rendererTimestamp: entry.timestamp,
    }),
  );
}

function menuStateChanged(previous: HostMenuState, next: HostMenuState): boolean {
  return (
    previous.canSave !== next.canSave ||
    previous.canExport !== next.canExport ||
    previous.canTrimTimeline !== next.canTrimTimeline ||
    previous.canToggleTimeline !== next.canToggleTimeline ||
    previous.isRecording !== next.isRecording ||
    previous.recordingURL !== next.recordingURL ||
    previous.locale !== next.locale ||
    previous.densityMode !== next.densityMode ||
    !studioShortcutOverridesEqual(previous.shortcutOverrides, next.shortcutOverrides)
  );
}

function ignoreDesktopShellEffectBeforeRuntimeStart<A, E>(
  _effect: Effect.Effect<A, E, never>,
): void {
  console.warn("Desktop shell effect ignored before managed runtime start");
}

function makeDesktopRuntimeFlags(options: DesktopShellLayerOptions): DesktopRuntimeFlags {
  return {
    captureBenchmarkEnabled: options.captureBenchmarkEnabled === true,
    studioDiagnosticsEnabled: options.studioDiagnosticsEnabled === true,
  };
}

/** Builds the scoped desktop shell layer around Electrobun resources. */
export function makeLayerDesktopShell(options: DesktopShellLayerOptions = {}) {
  return Layer.effect(
    DesktopShell,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const mainWindowRef = yield* Ref.make(Option.none<MainWindow>());
        const linuxTrayRef = yield* Ref.make(Option.none<Tray>());
        const hostMenuStateRef = yield* Ref.make(initialHostMenuState);
        const hasStartedRef = yield* Ref.make(false);
        const runtimeFlags = makeDesktopRuntimeFlags(options);
        const captureBenchmarkEnabled = runtimeFlags.captureBenchmarkEnabled;
        const studioDiagnosticsEnabled = runtimeFlags.studioDiagnosticsEnabled;
        const devServerPort = options.devServerPort ?? DEFAULT_DEV_SERVER_PORT;
        const devURL = devServerURL(devServerPort);
        let runShellEffect = ignoreDesktopShellEffectBeforeRuntimeStart;

        const getElectrobunChannel = Effect.promise(() => Updater.localInfo.channel());

        const getMainViewURL = (channel: string) =>
          Effect.promise(async () => {
            const bundledMainViewURL = "views://mainview/index.html";

            if (captureBenchmarkEnabled) {
              return bundledMainViewURL;
            }

            if (channel === "dev") {
              try {
                await fetch(devURL, { method: "HEAD" });
                console.log(`HMR enabled: Using Vite dev server at ${devURL}`);
                return appendStudioDiagnosticsQuery(devURL, studioDiagnosticsEnabled);
              } catch {
                console.log(
                  `Vite dev server not running at ${devURL}. Falling back to bundled mainview.`,
                );
              }
            }

            return appendStudioDiagnosticsQuery(bundledMainViewURL, studioDiagnosticsEnabled);
          });

        const dispatchHostCommand = (command: HostMenuCommand) =>
          Effect.gen(function* () {
            const window = Option.getOrNull(yield* Ref.get(mainWindowRef));
            if (!window) {
              return;
            }

            yield* Effect.sync(() => {
              try {
                window.webview.rpc?.send.hostMenuCommand({ command });
              } catch (error) {
                console.warn("Failed to dispatch host menu command:", command, error);
              }
            });
          });

        const dispatchDesktopRuntimeFlags = Effect.gen(function* () {
          const window = Option.getOrNull(yield* Ref.get(mainWindowRef));
          if (!window) {
            return;
          }

          yield* Effect.sync(() => {
            try {
              window.webview.rpc?.send.desktopRuntimeFlags(runtimeFlags);
            } catch (error) {
              console.warn("Failed to dispatch desktop runtime flags:", error);
            }
          });
        });

        const applyShellMenus: Effect.Effect<void> = Effect.gen(function* () {
          const hostMenuState = yield* Ref.get(hostMenuStateRef);

          yield* Effect.sync(() => {
            try {
              ApplicationMenu.setApplicationMenu(buildApplicationMenu(hostMenuState));
            } catch (error) {
              console.warn("Application menu setup failed:", error);
            }
          });

          if (process.platform !== "linux") {
            return;
          }

          let linuxTray = Option.getOrNull(yield* Ref.get(linuxTrayRef));
          if (!linuxTray) {
            linuxTray = new Tray({ title: "GG" });
            linuxTray.on("tray-clicked", (event: unknown) => {
              const action = extractMenuAction(event);
              if (!action) {
                return;
              }
              runShellEffect(handleShellAction(action));
            });
            yield* Ref.set(linuxTrayRef, Option.some(linuxTray));
          }

          linuxTray.setMenu(buildLinuxTrayMenu(hostMenuState));
        });

        const handleShellAction = (action: string): Effect.Effect<void> =>
          Effect.sync(() => {
            routeMenuAction(action, {
              dispatchHostCommand: (command) => {
                runShellEffect(dispatchHostCommand(command));
              },
              toggleDevTools: () => {
                runShellEffect(
                  Ref.get(mainWindowRef).pipe(
                    Effect.map((windowOption) =>
                      Option.getOrNull(windowOption)?.webview.toggleDevTools(),
                    ),
                  ),
                );
              },
              openDocs: () => {
                void Utils.openExternal("https://github.com/okikeSolutions/guerillaglass");
              },
              quit: () => Utils.quit(),
            });
          });

        const updateHostMenuState = (nextState: HostMenuState): Effect.Effect<void> =>
          Effect.gen(function* () {
            const previous = yield* Ref.get(hostMenuStateRef);
            if (!menuStateChanged(previous, nextState)) {
              return;
            }

            console.info(
              `[host-menu] state changed canSave=${nextState.canSave} canExport=${nextState.canExport} canTrimTimeline=${nextState.canTrimTimeline} canToggleTimeline=${nextState.canToggleTimeline} isRecording=${nextState.isRecording} recordingURL=${nextState.recordingURL ?? "null"} locale=${nextState.locale ?? "en-US"} density=${nextState.densityMode ?? "comfortable"}`,
            );
            yield* Ref.set(hostMenuStateRef, nextState);
            yield* applyShellMenus;
          });

        const dispatchReviewEvent = (event: ReviewBridgeEvent) =>
          Effect.gen(function* () {
            const window = Option.getOrNull(yield* Ref.get(mainWindowRef));
            if (!window) {
              return;
            }

            yield* Effect.sync(() => {
              try {
                const payload = decodeUnknownWithSchemaSync(
                  hostReviewEventMessageSchema,
                  { event },
                  "host review event",
                );
                window.webview.rpc?.send.hostReviewEvent(payload);
              } catch (error) {
                console.warn("Failed to dispatch review bridge event:", event.type, error);
              }
            });
          });

        const start = ({ runtime, onClose }: DesktopShellStartOptions): Effect.Effect<void> =>
          Effect.gen(function* () {
            runShellEffect = <A, E>(effect: Effect.Effect<A, E, never>) => {
              void runtime.runPromise(effect).catch((error) => {
                console.warn("Desktop shell effect failed", error);
              });
            };

            const hasStarted = yield* Ref.get(hasStartedRef);
            if (hasStarted) {
              yield* Effect.logWarning("DesktopShell.start ignored because shell already started");
              return;
            }
            yield* Ref.set(hasStartedRef, true);

            const rpc = BrowserView.defineRPC<DesktopBridgeRPC>({
              maxRequestTime: maxElectrobunRequestTimeMs,
              handlers: {
                requests: createEngineBridgeHandlers({
                  runtime,
                }),
                messages: {
                  hostMenuState: (nextState: HostMenuState) => {
                    try {
                      const validatedState = decodeUnknownWithSchemaSync(
                        hostMenuStateSchema,
                        nextState,
                        "host menu state message",
                      );
                      runShellEffect(
                        Ref.get(hostMenuStateRef).pipe(
                          Effect.flatMap((previous) =>
                            updateHostMenuState({ ...previous, ...validatedState }),
                          ),
                        ),
                      );
                    } catch (error) {
                      console.warn("Rejected invalid host menu state message", error);
                    }
                  },
                  studioDiagnostics: (entry: StudioDiagnosticsEntry) => {
                    try {
                      runShellEffect(
                        logStudioDiagnostics(
                          decodeUnknownWithSchemaSync(
                            studioDiagnosticsEntrySchema,
                            entry,
                            "studio diagnostics message",
                          ),
                        ),
                      );
                    } catch (error) {
                      runShellEffect(
                        Effect.logWarning("rejected invalid studio diagnostics message").pipe(
                          Effect.annotateLogs({
                            component: "studio-diagnostics",
                            error: String(error),
                          }),
                        ),
                      );
                    }
                  },
                },
              },
            });

            yield* applyShellMenus;

            const channel = yield* getElectrobunChannel;
            const url = yield* getMainViewURL(channel);
            const window = new BrowserWindow({
              title: captureBenchmarkEnabled ? captureBenchmarkWindowTitle : "Guerillaglass",
              url,
              preload: `window.__ggDesktopRuntimeFlags = ${JSON.stringify(runtimeFlags)};`,
              rpc,
              navigationRules: buildMainViewNavigationRules(channel, devServerPort),
              sandbox: false,
              frame: {
                width: 1320,
                height: 860,
                x: 180,
                y: 100,
              },
            });
            yield* Ref.set(mainWindowRef, Option.some(window));

            setTimeout(() => {
              runShellEffect(applyShellMenus);
            }, 500);
            setTimeout(() => {
              runShellEffect(dispatchDesktopRuntimeFlags);
            }, 50);
            setTimeout(() => {
              runShellEffect(dispatchDesktopRuntimeFlags);
            }, 250);
            setTimeout(() => {
              runShellEffect(dispatchDesktopRuntimeFlags);
            }, 1000);

            // Electrobun's BrowserWindow.on, Tray.on, and ApplicationMenu events do not
            // expose unsubscribe functions, so shell startup is intentionally one-shot.
            Electrobun.events.on("application-menu-clicked", (event: unknown) => {
              const action = extractMenuAction(event);
              if (!action) {
                return;
              }
              runShellEffect(handleShellAction(action));
            });

            window.on("close", async () => {
              try {
                await onClose();
              } finally {
                Utils.quit();
              }
            });

            window.on("focus", () => {
              runShellEffect(applyShellMenus.pipe(Effect.andThen(dispatchDesktopRuntimeFlags)));
            });
          });

        const publishCaptureStatus = (captureStatus: CaptureStatusResult): Effect.Effect<void> =>
          Effect.gen(function* () {
            Option.getOrNull(yield* Ref.get(mainWindowRef))?.webview.rpc?.send.hostCaptureStatus({
              captureStatus,
            });
          });

        const dispose = Effect.gen(function* () {
          const tray = Option.getOrNull(yield* Ref.get(linuxTrayRef));
          tray?.remove();
          yield* Ref.set(linuxTrayRef, Option.none());
          yield* Ref.set(mainWindowRef, Option.none());
        });

        return DesktopShell.of({
          start,
          publishCaptureStatus,
          publishReviewEvent: dispatchReviewEvent,
          dispose,
        });
      }),
      (shell) => shell.dispose,
    ),
  );
}

/** Builds the desktop shell layer from typed app configuration. */
export const layerDesktopShellFromConfig = Layer.unwrap(
  Effect.map(AppConfig, (config) =>
    makeLayerDesktopShell({
      captureBenchmarkEnabled: config.captureBenchmarkEnabled,
      studioDiagnosticsEnabled: config.studioDiagnosticsEnabled,
      devServerPort: config.devServerPort,
    }),
  ),
);
