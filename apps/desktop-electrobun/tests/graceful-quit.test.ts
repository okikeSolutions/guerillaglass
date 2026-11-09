import { describe, expect, test } from "vitest";
import { makeGracefulQuit } from "../src/bun/shell/gracefulQuit";

function missingCleanupGate(): never {
  throw new Error("Cleanup gate not initialized");
}

describe("graceful desktop quit", () => {
  test("menu and window requests share cleanup and cannot quit before it finishes", async () => {
    const events: string[] = [];
    let release: () => void = missingCleanupGate;
    const cleanup = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requestQuit = makeGracefulQuit(
      async () => {
        events.push("dispose:start");
        await cleanup;
        events.push("dispose:complete");
      },
      () => {
        events.push("quit");
      },
    );
    const menuRequest = requestQuit();
    const windowRequest = requestQuit();
    expect(windowRequest).toBe(menuRequest);
    await Promise.resolve();
    expect(events).toEqual(["dispose:start"]);
    release();
    await Promise.all([menuRequest, windowRequest]);
    expect(events).toEqual(["dispose:start", "dispose:complete", "quit"]);
    expect(requestQuit()).toBe(menuRequest);
    expect(events.filter((event) => event === "quit")).toHaveLength(1);
  });

  test("cleanup rejection still finalizes once and remains visible to every caller", async () => {
    const failure = new Error("Disposal failed");
    let quits = 0;
    let disposals = 0;
    const requestQuit = makeGracefulQuit(
      async () => {
        disposals += 1;
        throw failure;
      },
      () => {
        quits += 1;
      },
    );
    const first = requestQuit();
    const duplicate = requestQuit();
    expect(duplicate).toBe(first);
    await expect(first).rejects.toBe(failure);
    await expect(duplicate).rejects.toBe(failure);
    expect(disposals).toBe(1);
    expect(quits).toBe(1);
  });
});
