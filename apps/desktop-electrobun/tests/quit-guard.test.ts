import { describe, expect, test } from "vitest";
import { makeQuitGuard } from "../src/bun/shell/quitGuard";
import { makeGracefulQuit } from "../src/bun/shell/gracefulQuit";

function unavailableConfirmation(): never {
  throw new Error("Confirmation has not opened");
}

describe("native quit protection", () => {
  test("menu, window and app quit coalesce, cancel preserves the runtime, later discard disposes once", async () => {
    let answer: (allow: boolean) => void = unavailableConfirmation;
    let confirmations = 0;
    let disposals = 0;
    let quits = 0;
    const guard = makeQuitGuard({
      confirm: () => {
        confirmations += 1;
        return new Promise<boolean>((resolve) => {
          answer = resolve;
        });
      },
      quit: makeGracefulQuit(
        async () => {
          disposals += 1;
        },
        () => {
          quits += 1;
        },
      ),
    });
    const closeEvent = { response: { allow: true } };
    expect(guard.vetoNativeQuit(closeEvent)).toBe(true);
    expect(closeEvent.response.allow).toBe(false);
    const first = guard.request();
    expect(guard.request()).toBe(first);
    await Promise.resolve();
    expect(confirmations).toBe(1);
    answer(false);
    await first;
    expect(guard.approved).toBe(false);
    expect(disposals).toBe(0);
    const second = guard.request();
    await Promise.resolve();
    answer(true);
    await second;
    expect(confirmations).toBe(2);
    expect(disposals).toBe(1);
    expect(quits).toBe(1);
    expect(guard.request()).toBe(second);
  });

  test("approved teardown permits reentrant before-quit and preserves pending-picker cleanup ordering", async () => {
    const events: string[] = [];
    const guard = makeQuitGuard({
      confirm: async () => true,
      quit: makeGracefulQuit(
        async () => {
          events.push("picker:cancel");
          events.push("runtime:dispose");
        },
        () => {
          const event = { response: { allow: true } };
          expect(guard.vetoNativeQuit(event)).toBe(false);
          expect(event.response.allow).toBe(true);
          expect(guard.approved).toBe(true);
          events.push("native:quit");
        },
      ),
    });
    await guard.request();
    expect(events).toEqual(["picker:cancel", "runtime:dispose", "native:quit"]);
  });

  test("confirmation failure keeps the window/runtime alive and can be retried", async () => {
    let attempts = 0;
    let quits = 0;
    const guard = makeQuitGuard({
      confirm: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("Dialog unavailable");
        }
        return true;
      },
      quit: async () => {
        quits += 1;
      },
    });
    await expect(guard.request()).rejects.toThrow("Dialog unavailable");
    expect(guard.approved).toBe(false);
    expect(quits).toBe(0);
    await guard.request();
    expect(quits).toBe(1);
  });
});
