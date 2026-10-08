import { Effect, FileSystem, Path, Schedule, Schema, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import type { ChildProcessHandle } from "effect/process/ChildProcessSpawner";

class DesktopLaunchError extends Schema.TaggedError<DesktopLaunchError>()("DesktopLaunchError", {
  message: Schema.String,
}) {}

const AppProcessIdentity = Schema.Struct({
  pid: Schema.Int.pipe(Schema.check(Schema.isGreaterThan(1))),
  launchTime: Schema.Finite,
});
interface AppProcessIdentity extends Schema.Schema.Type<typeof AppProcessIdentity> {}

export interface MacosAppProcess {
  readonly pid: number;
  readonly launchTime: number;
  readonly bundlePath: string;
  readonly waiter: ChildProcessHandle;
}

const macosAppHelperPath = Effect.fn("DesktopLaunch.helperPath")(function* () {
  const path = yield* Path.Path;
  return yield* path.fromFileUrl(
    new URL("../../../Scripts/macos_app_process.swift", import.meta.url),
  );
});

const readAppPid = Effect.fn("DesktopLaunch.readAppPid")(function* (
  bundlePath: string,
  mode: "pid" | "ready" = "pid",
) {
  const helper = yield* macosAppHelperPath();
  const child = yield* ChildProcess.make("swift", [helper, mode, bundlePath], {
    stdin: "ignore",
    stderr: "ignore",
  });
  const output = yield* child.stdout.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (previous, chunk) => previous + chunk,
    ),
  );
  if ((yield* child.exitCode) !== 0) {
    return yield* new DesktopLaunchError({
      message: "App has not registered with LaunchServices.",
    });
  }
  return yield* Schema.decodeEffect(Schema.fromJsonString(Schema.NullOr(AppProcessIdentity)))(
    output.trim(),
  );
}, Effect.scoped);

const signalMacosApp = Effect.fn("DesktopLaunch.signal")(function* (
  app: AppProcessIdentity & { readonly bundlePath: string },
) {
  const helper = yield* macosAppHelperPath();
  const child = yield* ChildProcess.make(
    "swift",
    [helper, "stop", app.bundlePath, String(app.pid), String(app.launchTime)],
    {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "inherit",
    },
  );
  if ((yield* child.exitCode) !== 0) {
    return yield* new DesktopLaunchError({ message: "Unable to stop the selected app instance." });
  }
}, Effect.scoped);

/** Launches the packaged app with its own macOS privacy attribution and explicit child environment. */
const acquireMacosApp = Effect.fn("DesktopLaunch.acquire")(function* (options: {
  readonly bundlePath: string;
  readonly consolePath: string;
  readonly env: Readonly<Record<string, string>>;
}) {
  const fs = yield* FileSystem.FileSystem;
  if (!(yield* fs.exists(options.bundlePath))) {
    return yield* new DesktopLaunchError({ message: `Missing app bundle: ${options.bundlePath}` });
  }
  if ((yield* readAppPid(options.bundlePath)) !== null) {
    return yield* new DesktopLaunchError({
      message: "Close the existing desktop app before launching another instance.",
    });
  }
  // launchd opens the output file before the app starts. Keep this outside a
  // protected/removable repo volume; callers retain a copy with their artifacts.
  yield* fs.writeFileString(options.consolePath, "");
  const args = [
    "-n",
    options.bundlePath,
    "--stdout",
    options.consolePath,
    "--stderr",
    options.consolePath,
  ];
  for (const [key, value] of Object.entries(options.env)) {
    args.push("--env", `${key}=${value}`);
  }
  return yield* Effect.gen(function* () {
    const exitCode = yield* Effect.scoped(
      Effect.gen(function* () {
        const launch = yield* ChildProcess.make("/usr/bin/open", args, {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "inherit",
        });
        return yield* launch.exitCode;
      }),
    );
    if (exitCode !== 0) {
      return yield* new DesktopLaunchError({ message: "LaunchServices rejected the app launch." });
    }
    const identity = yield* readAppPid(options.bundlePath, "ready").pipe(
      Effect.filterOrFail(
        (identity) => identity !== null,
        () => new DesktopLaunchError({ message: "App has not registered with LaunchServices." }),
      ),
      Effect.retry({
        while: (error) => error instanceof DesktopLaunchError,
        schedule: Schedule.spaced("200 millis"),
        times: 20,
      }),
    );
    const helper = yield* macosAppHelperPath();
    const waiter = yield* ChildProcess.make(
      "swift",
      [helper, "wait", options.bundlePath, String(identity.pid), String(identity.launchTime)],
      {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
      },
    );
    return { ...identity, bundlePath: options.bundlePath, waiter } satisfies MacosAppProcess;
  }).pipe(
    Effect.onError(() =>
      Effect.gen(function* () {
        // Roll back an app created before a readiness query fails.
        const identity = yield* readAppPid(options.bundlePath);
        if (identity !== null) {
          yield* signalMacosApp({ ...identity, bundlePath: options.bundlePath });
        }
      }).pipe(Effect.orDie),
    ),
  );
});

/** Stops only the selected bundle instance and waits for LaunchServices to observe its exit. */
export const stopMacosApp = Effect.fn("DesktopLaunch.stop")(function* (app: MacosAppProcess) {
  yield* Effect.logInfo(`Stopping desktop host ${app.pid}.`);
  yield* signalMacosApp(app);
  yield* app.waiter.exitCode.pipe(Effect.timeout("10 seconds"));
  yield* Effect.logInfo(`Desktop host ${app.pid} exited.`);
});

/** Owns the selected app instance until the caller's scope closes. */
export const launchMacosApp = Effect.fn("DesktopLaunch.launch")(
  (options: Parameters<typeof acquireMacosApp>[0]) =>
    Effect.acquireRelease(acquireMacosApp(options), (app) =>
      Effect.scoped(stopMacosApp(app)).pipe(Effect.orDie),
    ),
);
