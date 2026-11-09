import { expect, test } from "vitest";
import { createEngineBridgeHandlers } from "../src/bun/bridge/requestHandlers";

test("a disposed host returns an opaque RPC error instead of rejecting during instrumentation", async () => {
  const handlers = createEngineBridgeHandlers({
    runtime: {
      runPromise: async () => {
        throw new Error("ManagedRuntime disposed: private shutdown detail");
      },
      dispose: async () => {},
    },
  });
  const response = await handlers.ggPickPath({ mode: "export" });
  expect(response).toMatchObject({
    ok: false,
    error: { tag: "BridgeUnavailableError", data: { bridge: "ggPickPath" } },
  });
  expect(JSON.stringify(response)).not.toContain("private shutdown detail");
});
