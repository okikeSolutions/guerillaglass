import { stdin, stdout } from "node:process";

type Request = {
  id: string;
  method: string;
  params?: Record<string, unknown>;
};

type Response =
  | { id: string; ok: true; result: unknown }
  | { id: string; ok: false; error: { code: string; message: string } };

let isRunning = false;

function writeResponse(response: Response): void {
  stdout.write(`${JSON.stringify(response)}\n`);
}

function statusResult() {
  return {
    isRunning,
    isRecording: false,
    recordingDurationSeconds: 0,
    recordingURL: null,
    captureMetadata: isRunning
      ? {
          source: "window",
          window: {
            id: 5001,
            title: "Unknown Stop State Timeout Fixture",
            appName: "Fixture",
          },
          contentRect: { x: 0, y: 0, width: 1280, height: 720 },
          pixelScale: 1,
        }
      : null,
    lastError: null,
    eventsURL: null,
    lastRecordingTelemetry: null,
    telemetry: {
      sourceDroppedFrames: 0,
      writerDroppedFrames: 0,
      writerBackpressureDrops: 0,
      achievedFps: 0,
      cpuPercent: null,
      memoryBytes: null,
      recordingBitrateMbps: null,
      captureCallbackMs: 0,
      recordQueueLagMs: 0,
      writerAppendMs: 0,
    },
  };
}

function handleRequest(request: Request): Response | null {
  switch (request.method) {
    case "capture.startCurrentWindow":
      isRunning = true;
      return { id: request.id, ok: true, result: statusResult() };
    case "capture.stop":
      // Simulate dropped/blocked stop response.
      return null;
    case "capture.status":
      // Simulate status probe timeout after stop timeout.
      return null;
    default:
      return {
        id: request.id,
        ok: false,
        error: {
          code: "unsupported_method",
          message: `Unsupported method: ${request.method}`,
        },
      };
  }
}

const decoder = new TextDecoder();
let buffer = "";

for await (const chunk of stdin) {
  buffer += decoder.decode(chunk, { stream: true });

  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const raw = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");
    if (!raw) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    if (
      typeof parsed !== "object" ||
      parsed == null ||
      typeof (parsed as { id?: unknown }).id !== "string" ||
      typeof (parsed as { method?: unknown }).method !== "string"
    ) {
      continue;
    }

    const response = handleRequest(parsed as Request);
    if (response) {
      writeResponse(response);
    }
  }
}
