import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const lockPath = path.join(os.tmpdir(), "guerillaglass-slow-shutdown.lock");
const statePath = path.join(os.tmpdir(), "guerillaglass-slow-shutdown.state");

fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });

function cleanupLock(): void {
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // Best-effort cleanup for test fixtures.
  }
}

process.on("exit", cleanupLock);
process.on("SIGTERM", () => {
  setTimeout(() => {
    cleanupLock();
    process.exit(0);
  }, 200);
});

let buffer = "";
for await (const chunk of Bun.stdin.stream()) {
  buffer += new TextDecoder().decode(chunk);
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (line.length > 0) {
      const request = JSON.parse(line) as { id: string; method: string };
      if (request.method === "system.ping" && !fs.existsSync(statePath)) {
        fs.writeFileSync(statePath, "timed-out");
      } else {
        process.stdout.write(
          `${JSON.stringify({
            id: request.id,
            ok: true,
            result: {
              app: "guerillaglass",
              engineVersion: "test",
              protocolVersion: "1",
              platform: "linux",
            },
          })}\n`,
        );
      }
    }
    newlineIndex = buffer.indexOf("\n");
  }
}
