import { describe, expect, test } from "vitest";
import { Effect } from "effect";
import { makeExportResultActions } from "../src/bun/session/exportResultActions";
import { bridgeDefinitionsByName } from "../src/shared/bridge/desktopBridgeContract";
import { Schema } from "effect";

describe("completed export authority", () => {
  test("no file action is allowed before a successful result is remembered", async () => {
    let calls = 0;
    const actions = await Effect.runPromise(
      makeExportResultActions({
        open: () =>
          Effect.sync(() => {
            calls += 1;
            return true;
          }),
        reveal: () =>
          Effect.sync(() => {
            calls += 1;
          }),
      }),
    );
    await expect(Effect.runPromise(actions.act("open"))).rejects.toThrow("No completed export");
    expect(calls).toBe(0);
  });

  test("renderer-supplied paths cannot override the exact host-owned output", async () => {
    const opened: string[] = [];
    const actions = await Effect.runPromise(
      makeExportResultActions({
        open: (path) =>
          Effect.sync(() => {
            opened.push(path);
            return true;
          }),
        reveal: (path) =>
          Effect.sync(() => {
            opened.push(path);
          }),
      }),
    );
    await Effect.runPromise(actions.remember("/chosen/export.mp4"));
    const params = Schema.decodeUnknownSync(
      bridgeDefinitionsByName.ggOpenExportResult.paramsSchema,
    )({ action: "open", path: "/untrusted/file.mp4" });
    await Effect.runPromise(actions.act(params.action));
    await Effect.runPromise(actions.act("reveal"));
    expect(opened).toEqual(["/chosen/export.mp4", "/chosen/export.mp4"]);
  });

  test("an OS open failure remains an actionable error", async () => {
    const actions = await Effect.runPromise(
      makeExportResultActions({ open: () => Effect.succeed(false), reveal: () => Effect.void }),
    );
    await Effect.runPromise(actions.remember("/chosen/export.mp4"));
    await expect(Effect.runPromise(actions.act("open"))).rejects.toThrow("could not be opened");
  });
});
