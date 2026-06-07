import path from "node:path";
import { describe, expect, test } from "bun:test";

type WireResponse = {
  jsonrpc: "2.0";
  id: string | number;
  error?: {
    _tag: "Cause";
    message: string;
    data: Array<{ _tag: "Fail"; error: { _tag: "EngineRpcError"; code: string } }>;
  };
};

function createLineClient(stubPath: string) {
  const command = stubPath.endsWith(".ts") ? ["bun", stubPath] : [stubPath];
  const process = Bun.spawn({
    cmd: command,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdin = process.stdin;
  const reader = process.stdout.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const readLine = async (): Promise<string> => {
    while (true) {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        return line;
      }

      const { value, done } = await reader.read();
      if (done) {
        throw new Error("Stub engine closed stdout unexpectedly");
      }
      buffer += decoder.decode(value, { stream: true });
    }
  };

  return {
    async send(rawLine: string): Promise<WireResponse> {
      await stdin.write(encoder.encode(`${rawLine}\n`));
      const line = await readLine();
      return JSON.parse(line) as WireResponse;
    },
    async close() {
      await stdin.end();
      reader.releaseLock();
      process.kill();
    },
  };
}

describe("stub engine process", () => {
  const linuxStubPath = path.resolve(
    import.meta.dir,
    "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
  );

  test("returns invalid_request for malformed JSON", async () => {
    const client = createLineClient(linuxStubPath);
    try {
      const response = await client.send("not-json");
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe("unknown");
      expect(response.error?.data[0]?.error.code).toBe("invalid_request");
    } finally {
      await client.close();
    }
  });

  test("returns unsupported_method for unknown method", async () => {
    const client = createLineClient(linuxStubPath);
    try {
      const response = await client.send(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "capture.flyToMoon", params: {} }),
      );
      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.error?.data[0]?.error.code).toBe("unsupported_method");
    } finally {
      await client.close();
    }
  });
});
