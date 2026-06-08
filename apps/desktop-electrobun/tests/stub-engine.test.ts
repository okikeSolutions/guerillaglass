import path from "node:path";
import processEnv from "node:process";
import { describe, expect, test } from "bun:test";

type WireResponse = {
  type: "response" | "error";
  id: string | number;
  error?: {
    code: string;
    message: string;
  };
};

type ReadyMessage = {
  type: "guerillaglass.engine.ready";
  host: string;
  port: number;
};

async function readProcessLine(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex >= 0) {
      return buffer.slice(0, newlineIndex);
    }
    const { value, done } = await reader.read();
    if (done) {
      throw new Error("Stub engine closed stdout unexpectedly");
    }
    buffer += decoder.decode(value, { stream: true });
  }
}

async function createSocketClient(stubPath: string) {
  const authToken = "stub-test-token";
  const command = stubPath.endsWith(".ts") ? ["bun", stubPath] : [stubPath];
  const process = Bun.spawn({
    cmd: command,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...processEnv.env,
      GG_ENGINE_RPC_AUTH_TOKEN: authToken,
    },
  });

  const stdoutReader = process.stdout.getReader();
  const ready = JSON.parse(await readProcessLine(stdoutReader)) as ReadyMessage;
  expect(ready.type).toBe("guerillaglass.engine.ready");

  let buffer = "";
  let resolveLine: ((line: string) => void) | null = null;
  const socket = await Bun.connect<{ decoder: TextDecoder }>({
    hostname: ready.host,
    port: ready.port,
    socket: {
      open(socket) {
        socket.data = { decoder: new TextDecoder() };
      },
      data(socket, data) {
        buffer += socket.data.decoder.decode(data, { stream: true });
        const newlineIndex = buffer.indexOf("\n");
        if (newlineIndex >= 0 && resolveLine) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          const resolve = resolveLine;
          resolveLine = null;
          resolve(line);
        }
      },
    },
  });

  const readLine = () =>
    new Promise<string>((resolve) => {
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        resolve(line);
        return;
      }
      resolveLine = resolve;
    });

  return {
    async send(rawRequest: Record<string, unknown> | string): Promise<WireResponse> {
      const rawLine = typeof rawRequest === "string" ? rawRequest : JSON.stringify(rawRequest);
      socket.write(`${rawLine}\n`);
      return JSON.parse(await readLine()) as WireResponse;
    },
    async close() {
      socket.end();
      stdoutReader.releaseLock();
      process.kill();
      await process.exited.catch(() => undefined);
    },
    authToken,
  };
}

describe("stub engine process", () => {
  const linuxStubPath = path.resolve(
    import.meta.dir,
    "../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
  );

  test("returns invalid_request for malformed JSON", async () => {
    const client = await createSocketClient(linuxStubPath);
    try {
      const response = await client.send("not-json");
      expect(response.type).toBe("error");
      expect(response.id).toBe("unknown");
      expect(response.error?.code).toBe("invalid_request");
    } finally {
      await client.close();
    }
  });

  test("returns unsupported_method for unknown method", async () => {
    const client = await createSocketClient(linuxStubPath);
    try {
      const response = await client.send({
        type: "request",
        id: 1,
        method: "capture.flyToMoon",
        params: {},
        authToken: client.authToken,
      });
      expect(response.type).toBe("error");
      expect(response.id).toBe(1);
      expect(response.error?.code).toBe("unsupported_method");
    } finally {
      await client.close();
    }
  });
});
