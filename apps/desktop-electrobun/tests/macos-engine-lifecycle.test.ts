import fs from "node:fs";
import path from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Stream } from "effect";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const enginePath = path.join(repoRoot, ".build/debug/guerillaglass-engine");

async function runCommand(command: string, args: readonly string[], timeoutMs = 30_000) {
  return await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* ChildProcess.make(command, args, {
          cwd: repoRoot,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
        });
        const result = yield* Effect.all({
          exitCode: handle.exitCode,
          stderr: handle.stderr.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (accumulator, chunk) => accumulator + chunk,
            ),
          ),
          stdout: handle.stdout.pipe(
            Stream.decodeText(),
            Stream.runFold(
              () => "",
              (accumulator, chunk) => accumulator + chunk,
            ),
          ),
        });
        return result;
      }).pipe(
        Effect.timeout(timeoutMs),
        Effect.catchTag("TimeoutError", () =>
          Effect.succeed({ exitCode: -1, stderr: "command timed out", stdout: "" }),
        ),
      ),
    ).pipe(Effect.provide(NodeServices.layer)),
  );
}

describe.skipIf(process.platform !== "darwin")("macOS engine lifecycle", () => {
  test("engine exits when its parent process exits", async () => {
    if (!fs.existsSync(enginePath)) {
      const build = await runCommand(
        "swift",
        ["build", "--product", "guerillaglass-engine"],
        240_000,
      );
      expect(build.exitCode, build.stderr).toBe(0);
    }

    const quotedEnginePath = JSON.stringify(enginePath);
    const script = String.raw`
set -euo pipefail
out="$(mktemp)"
pidfile="$(mktemp)"
(
  GG_ENGINE_TRANSPORT=http GG_ENGINE_HTTP_AUTH_TOKEN=test-token ${quotedEnginePath} > "$out" 2>&1 &
  echo $! > "$pidfile"
  sleep 1
  kill -0 "$(cat "$pidfile")"
) &
wrapper=$!
wait "$wrapper"
pid="$(cat "$pidfile")"
sleep 2
if kill -0 "$pid" 2>/dev/null; then
  cat "$out" >&2
  kill "$pid" 2>/dev/null || true
  exit 1
fi
cat "$out"
`;
    const result = await runCommand("bash", ["-lc", script], 20_000);

    expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(
      /engine parent process exited|engine started without a live parent process; shutting down/,
    );
  }, 260_000);
});
