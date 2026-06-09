import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, platform, release } from "node:os";

let installed = false;
let logPath: string | null = null;

function resolveDiagnosticsLogPath(): string {
  const configured = process.env.GG_DESKTOP_DIAGNOSTICS_LOG?.trim();
  if (configured) {
    return configured;
  }
  return join(homedir(), "Library", "Logs", "Guerillaglass", "desktop-electrobun.log");
}

function safeSerialize(value: unknown): string {
  if (value instanceof Error) {
    return JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause,
    });
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function writeEarlyDesktopDiagnostic(event: string, fields: Record<string, unknown> = {}) {
  if (!logPath) {
    return;
  }
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    pid: process.pid,
    ppid: process.ppid,
    ...fields,
  };
  try {
    appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Logging must never become part of the failure mode being diagnosed.
  }
}

function installProcessHooks() {
  process.on("uncaughtExceptionMonitor", (error, origin) => {
    writeEarlyDesktopDiagnostic("uncaught-exception-monitor", {
      origin,
      error: safeSerialize(error),
    });
  });
  process.on("unhandledRejection", (reason) => {
    writeEarlyDesktopDiagnostic("unhandled-rejection", { reason: safeSerialize(reason) });
  });
  process.on("rejectionHandled", () => {
    writeEarlyDesktopDiagnostic("rejection-handled");
  });
  process.on("warning", (warning) => {
    writeEarlyDesktopDiagnostic("process-warning", { warning: safeSerialize(warning) });
  });
  process.on("beforeExit", (code) => {
    writeEarlyDesktopDiagnostic("before-exit", { code });
  });
  process.on("exit", (code) => {
    writeEarlyDesktopDiagnostic("exit", { code });
  });
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      writeEarlyDesktopDiagnostic("signal", { signal });
    });
  }
}

function installHeartbeat() {
  const interval = setInterval(() => {
    writeEarlyDesktopDiagnostic("heartbeat", {
      uptimeSeconds: process.uptime(),
      memoryUsage: process.memoryUsage(),
      resourceUsage:
        typeof process.resourceUsage === "function" ? process.resourceUsage() : undefined,
    });
  }, 2000);
  interval.unref?.();
}

/**
 * Installs crash-oriented diagnostics before app bootstrap. This intentionally
 * records process lifecycle events to a plain JSONL file so logs survive
 * Electrobun/Bun crashes that may bypass Effect scope finalizers.
 */
export function installEarlyDesktopDiagnostics() {
  if (installed || process.env.GG_DESKTOP_FILE_LOG === "0") {
    return;
  }
  installed = true;
  logPath = resolveDiagnosticsLogPath();
  try {
    mkdirSync(dirname(logPath), { recursive: true });
  } catch {
    logPath = join("/tmp", "guerillaglass-desktop-electrobun.log");
  }

  installProcessHooks();
  installHeartbeat();

  writeEarlyDesktopDiagnostic("diagnostics-installed", {
    logPath,
    argv: process.argv,
    cwd: process.cwd(),
    execPath: process.execPath,
    platform: platform(),
    osRelease: release(),
    nodeEnv: process.env.NODE_ENV ?? null,
    electrobunBuild: process.env.ELECTROBUN_BUILD ?? null,
    ggEnginePath: process.env.GG_ENGINE_PATH ?? null,
    ggStudioDiagnostics: process.env.GG_STUDIO_DIAGNOSTICS ?? null,
  });
}

export function desktopDiagnosticsLogPath(): string | null {
  return logPath;
}
