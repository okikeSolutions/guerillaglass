import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect, Exit, FileSystem, Option, Path, Schema, Scope, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import { launchMacosApp } from "./macosApp";

class DesktopDevError extends Schema.TaggedError<DesktopDevError>()("DesktopDevError", {
  message: Schema.String,
}) {}

const runBuildCommand = Effect.fn("DesktopDev.runBuildCommand")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
) {
  const child = yield* ChildProcess.make("bun", args, {
    cwd,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = yield* child.exitCode;
  if (exitCode !== 0) {
    return yield* new DesktopDevError({
      message: `bun ${args.join(" ")} failed with exit ${exitCode}`,
    });
  }
}, Effect.scoped);

const main = Effect.scoped(
  Effect.gen(function* () {
    if (process.platform !== "darwin") {
      return yield* new DesktopDevError({
        message: "The desktop dev runner currently requires the macOS engine.",
      });
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const appRoot = path.resolve(import.meta.dir, "..");
    const repoRoot = path.resolve(appRoot, "../..");
    const customEngine = yield* Config.option(Config.String("GG_ENGINE_PATH"));
    const enginePath = Option.getOrElse(customEngine, () =>
      path.join(repoRoot, ".build/debug/guerillaglass-engine"),
    );
    if (!path.isAbsolute(enginePath)) {
      return yield* new DesktopDevError({ message: "GG_ENGINE_PATH must be absolute." });
    }
    const diagnostics = yield* Config.Boolean("GG_DEBUG").pipe(Config.withDefault(false));
    const vite = process.argv.slice(2).includes("--hmr")
      ? yield* ChildProcess.make("bun", ["run", "hmr"], {
          cwd: appRoot,
          stdin: "ignore",
          stdout: "inherit",
          stderr: "inherit",
        })
      : undefined;
    const logs = yield* fs.makeTempDirectoryScoped({ prefix: "guerillaglass-dev-" });
    const consolePath = path.join(logs, "console.log");
    const bundlePath = path.join(appRoot, `build/dev-macos-${process.arch}/Guerillaglass-dev.app`);
    let currentAppScope: Scope.Closeable | undefined;

    const buildAndLaunch = Effect.fn("DesktopDev.buildAndLaunch")(function* () {
      if (currentAppScope) {
        yield* Scope.close(currentAppScope, Exit.void);
        currentAppScope = undefined;
      }
      if (Option.isNone(customEngine)) {
        yield* runBuildCommand(appRoot, ["run", "native:build:macos"]);
      }
      yield* runBuildCommand(appRoot, ["run", "build"]);
      currentAppScope = yield* Effect.acquireRelease(Scope.make(), (scope) =>
        Scope.close(scope, Exit.void),
      );
      const currentApp = yield* launchMacosApp({
        bundlePath,
        consolePath,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).flatMap(([key, value]) =>
              value !== undefined && /^(GG_|VITE_|NODE_ENV$|BUN_INSPECT$)/.test(key)
                ? [[key, value]]
                : [],
            ),
          ),
          GG_ENGINE_PATH: enginePath,
          GG_DEBUG: String(diagnostics),
        },
      }).pipe(Scope.provide(currentAppScope));
      yield* Effect.logInfo(`Desktop launched through LaunchServices. Console: ${consolePath}`);
      return currentApp;
    });

    const app = yield* buildAndLaunch();
    if (!process.argv.slice(2).includes("--watch")) {
      yield* vite
        ? Effect.raceFirst(
            app.waiter.exitCode,
            vite.exitCode.pipe(
              Effect.flatMap(
                (code) => new DesktopDevError({ message: `Vite exited with code ${code}.` }),
              ),
            ),
          )
        : app.waiter.exitCode;
      return;
    }
    // Renderer HMR uses the separate Vite task. Whole-app mode rebuilds the host,
    // copied renderer, and native engine sequentially after source changes.
    yield* Stream.mergeAll(
      [
        fs.watch(path.join(appRoot, "src"), { recursive: true }),
        fs.watch(path.join(appRoot, "electrobun.config.ts")),
        fs.watch(path.join(repoRoot, "engines/macos-swift"), { recursive: true }),
      ],
      { concurrency: 3 },
    ).pipe(
      Stream.filter((event) => !event.path.includes("paraglide")),
      Stream.debounce("350 millis"),
      Stream.runForEach(() =>
        buildAndLaunch().pipe(
          Effect.catchTag("DesktopDevError", (error) => Effect.logError(error.message)),
        ),
      ),
    );
  }),
);

NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)));
