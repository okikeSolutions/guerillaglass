import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import { Deferred, Effect, Fiber, FileSystem, Result, Sink, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { describe, expect } from "vitest";
import { launchMacosApp } from "../scripts/macosApp";

const options = {
  bundlePath: "/tmp/fixture/Guerillaglass-dev.app",
  consolePath: "/tmp/fixture/console.log",
  env: { GG_ENGINE_PATH: "/Volumes/Work SSD/custom engine=debug", GG_DEBUG: "1" },
};

function fixture(pidResponses: ReadonlyArray<string>, bundleExists = true) {
  const commands: ChildProcess.StandardCommand[] = [];
  let nextResponse = 0;
  const spawner = ChildProcessSpawner.make((command) => {
    if (command._tag !== "StandardCommand") {
      return Effect.die(new Error("Unexpected piped command."));
    }
    commands.push(command);
    const output =
      command.command === "swift" && ["pid", "ready"].includes(command.args[1] ?? "")
        ? (pidResponses[nextResponse++] ?? "null")
        : "";
    const stdout = Stream.make(new TextEncoder().encode(output));
    let active = false;
    const handle = ChildProcessSpawner.makeHandle({
      pid: ChildProcessSpawner.ProcessId(91),
      exitCode: Effect.suspend(() =>
        active
          ? Effect.succeed(ChildProcessSpawner.ExitCode(0))
          : Effect.die(new Error("Child scope closed before its exit was observed.")),
      ),
      isRunning: Effect.succeed(false),
      kill: () => Effect.void,
      stdin: Sink.drain,
      stdout,
      stderr: Stream.empty,
      all: stdout,
      getInputFd: () => Sink.drain,
      getOutputFd: () => Stream.empty,
      unref: Effect.succeed(Effect.void),
    });
    return Effect.acquireRelease(
      Effect.sync(() => {
        active = true;
        return handle;
      }),
      () =>
        Effect.sync(() => {
          active = false;
        }),
    );
  });
  const fs = FileSystem.makeNoop({
    exists: () => Effect.succeed(bundleExists),
    writeFileString: () => Effect.void,
  });
  const launch = launchMacosApp(options).pipe(
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
    Effect.provideService(FileSystem.FileSystem, fs),
    Effect.provide(NodeServices.layer),
  );
  return {
    commands,
    launch,
    run: Effect.scoped(launch),
  };
}

describe("macOS desktop launch lifecycle", () => {
  it.effect(
    "uses LaunchServices, preserves the custom engine path, and stops only its app identity",
    () =>
      Effect.gen(function* () {
        const test = fixture(["null", '{"pid":321,"launchTime":1234.5}']);
        const app = yield* test.run;
        expect(app.pid).toBe(321);
        const open = test.commands.find((command) => command.command === "/usr/bin/open");
        expect(open?.args).toEqual([
          "-n",
          options.bundlePath,
          "--stdout",
          options.consolePath,
          "--stderr",
          options.consolePath,
          "--env",
          `GG_ENGINE_PATH=${options.env.GG_ENGINE_PATH}`,
          "--env",
          "GG_DEBUG=1",
        ]);
        const stop = test.commands.find((command) => command.args[1] === "stop");
        expect(stop?.args.slice(1)).toEqual(["stop", options.bundlePath, "321", "1234.5"]);
        const wait = test.commands.find((command) => command.args[1] === "wait");
        expect(wait?.args.slice(1)).toEqual(["wait", options.bundlePath, "321", "1234.5"]);
      }),
  );

  it.effect("rejects a missing bundle or an already running instance before launch", () =>
    Effect.gen(function* () {
      for (const test of [fixture([], false), fixture(['{"pid":321,"launchTime":1234.5}'])]) {
        const result = yield* Effect.result(test.run);
        expect(Result.isFailure(result)).toBe(true);
        expect(test.commands.some((command) => command.command === "/usr/bin/open")).toBe(false);
      }
    }),
  );

  it.effect("rejects malformed process identities without sending a termination signal", () =>
    Effect.gen(function* () {
      for (const identity of ['{"pid":1,"launchTime":1234.5}', '{"pid":321}', "invalid-json"]) {
        const test = fixture([identity]);
        const result = yield* Effect.result(test.run);
        expect(Result.isFailure(result)).toBe(true);
        expect(test.commands.some((command) => command.args[1] === "stop")).toBe(false);
      }
    }),
  );

  it.effect("rolls back an app started before its readiness response becomes invalid", () =>
    Effect.gen(function* () {
      const test = fixture(["null", "invalid-json", '{"pid":321,"launchTime":1234.5}']);
      expect(Result.isFailure(yield* Effect.result(test.run))).toBe(true);
      expect(test.commands.filter((command) => command.command === "/usr/bin/open")).toHaveLength(
        1,
      );
      const stop = test.commands.find((command) => command.args[1] === "stop");
      expect(stop?.args.slice(1)).toEqual(["stop", options.bundlePath, "321", "1234.5"]);
    }),
  );

  it.effect("stops its app exactly once when the runner is interrupted", () =>
    Effect.gen(function* () {
      const test = fixture(["null", '{"pid":321,"launchTime":1234.5}']);
      const ready = yield* Deferred.make<void>();
      const runner = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* test.launch;
          yield* Deferred.succeed(ready, undefined);
          return yield* Effect.never;
        }),
      ).pipe(Effect.forkScoped);
      yield* Deferred.await(ready);
      yield* Fiber.interrupt(runner);
      expect(test.commands.filter((command) => command.args[1] === "stop")).toHaveLength(1);
    }),
  );
});
