import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "..");
const outputDirectory = path.join(repoRoot, ".tmp", "runtime-acceptance", "latest");
const diagnosticsLogPath = path.join(outputDirectory, "desktop-diagnostics.jsonl");
const consoleLogPath = path.join(outputDirectory, "desktop-console.log");
const reportJsonPath = path.join(outputDirectory, "report.json");
const reportMarkdownPath = path.join(outputDirectory, "report.md");
const screenshotPath = path.join(outputDirectory, "desktop-window.png");

const startupMilestones = [
  "engine process ready",
  "desktop shell started",
  "desktop bootstrap complete",
  "renderer diagnostics enabled",
] as const;
const fatalPatterns = [
  /empty response for URL/i,
  /desktop bootstrap failed/i,
  /unhandled(?: promise)? rejection/i,
  /uncaught exception/i,
  /"level":"fatal"/i,
];

type WindowRecord = {
  readonly id: number;
  readonly owner: string;
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly layer: number;
};

type RuntimeSmokeReport = {
  readonly status: "passed" | "failed";
  readonly startedAt: string;
  readonly durationMs: number;
  readonly appBundle: string;
  readonly enginePath: string;
  readonly milestones: Record<(typeof startupMilestones)[number], boolean>;
  readonly window: WindowRecord | null;
  readonly screenshot: { readonly status: "captured" | "unavailable"; readonly path: string };
  readonly fatalMatches: readonly string[];
  readonly cleanupPassed: boolean;
  readonly errors: readonly string[];
};

function hasFlag(flag: string): boolean {
  return process.argv.slice(2).includes(flag);
}

function flagValue(name: string, fallback: number): number {
  const value = process.argv.slice(2).find((argument) => argument.startsWith(`${name}=`));
  if (!value) {
    return fallback;
  }
  const parsed = Number(value.slice(name.length + 1));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${value}`);
  }
  return parsed;
}

async function run(
  command: readonly string[],
  environment?: Record<string, string>,
): Promise<void> {
  const subprocess = Bun.spawn([...command], {
    cwd: repoRoot,
    env: { ...process.env, ...environment },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await subprocess.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
  }
}

function readText(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

async function waitForStartup(
  processId: number,
  timeoutMs: number,
): Promise<Record<(typeof startupMilestones)[number], boolean>> {
  const deadline = Date.now() + timeoutMs;
  let milestones = Object.fromEntries(
    startupMilestones.map((milestone) => [milestone, false]),
  ) as Record<(typeof startupMilestones)[number], boolean>;

  while (Date.now() < deadline) {
    const diagnostics = readText(diagnosticsLogPath);
    milestones = Object.fromEntries(
      startupMilestones.map((milestone) => [milestone, diagnostics.includes(milestone)]),
    ) as Record<(typeof startupMilestones)[number], boolean>;
    if (Object.values(milestones).every(Boolean)) {
      return milestones;
    }

    try {
      process.kill(processId, 0);
    } catch {
      return milestones;
    }
    await Bun.sleep(250);
  }
  return milestones;
}

async function probeWindow(): Promise<WindowRecord | null> {
  const subprocess = Bun.spawn(["swift", "Scripts/macos_window_probe.swift", "Guerillaglass-dev"], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`Window probe failed: ${stderr.trim() || `exit ${exitCode}`}`);
  }
  const windows = JSON.parse(stdout) as readonly WindowRecord[];
  return (
    windows
      .filter((window) => window.layer === 0 && window.width >= 640 && window.height >= 480)
      .sort((left, right) => right.width * right.height - left.width * left.height)[0] ?? null
  );
}

async function captureWindow(window: WindowRecord | null): Promise<"captured" | "unavailable"> {
  if (!window) {
    return "unavailable";
  }
  const subprocess = Bun.spawn(["screencapture", "-x", "-l", String(window.id), screenshotPath], {
    cwd: repoRoot,
    stdout: "ignore",
    stderr: "ignore",
  });
  return (await subprocess.exited) === 0 && existsSync(screenshotPath) ? "captured" : "unavailable";
}

function stopProcessGroup(processId: number): Promise<boolean> {
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    try {
      process.kill(processId, "SIGTERM");
    } catch {
      return Promise.resolve(true);
    }
  }

  return (async () => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        process.kill(-processId, 0);
      } catch {
        return true;
      }
      await Bun.sleep(100);
    }
    try {
      process.kill(-processId, "SIGKILL");
    } catch {
      // The process group exited between the final poll and forced cleanup.
    }
    return false;
  })();
}

function renderMarkdown(report: RuntimeSmokeReport): string {
  const checks = [
    ...Object.entries(report.milestones).map(
      ([name, passed]) => `- [${passed ? "x" : " "}] ${name}`,
    ),
    `- [${report.window ? "x" : " "}] visible desktop window`,
    `- [${report.cleanupPassed ? "x" : " "}] process cleanup`,
  ];
  return `# Desktop runtime smoke report\n\n**Status:** ${report.status}\n\n${checks.join("\n")}\n\n- Duration: ${report.durationMs} ms\n- App bundle: \`${report.appBundle}\`\n- Engine: \`${report.enginePath}\`\n- Screenshot: ${report.screenshot.status}\n- Fatal matches: ${report.fatalMatches.length}\n\n${report.errors.map((error) => `- Error: ${error}`).join("\n")}\n`;
}

async function main(): Promise<void> {
  if (process.platform !== "darwin") {
    throw new Error("The real Electrobun runtime smoke gate currently requires macOS.");
  }

  const startedAt = new Date();
  const timeoutMs = flagValue("--timeout-ms", 30_000);
  const requireScreenshot = hasFlag("--require-screenshot");
  const skipBuild = hasFlag("--skip-build");
  const architecture = process.arch === "arm64" ? "arm64" : "x64";
  const appBundle = path.join(
    repoRoot,
    "apps",
    "desktop-electrobun",
    "build",
    `dev-macos-${architecture}`,
    "Guerillaglass-dev.app",
  );
  const launcherPath = path.join(appBundle, "Contents", "MacOS", "launcher");
  const enginePath = path.join(repoRoot, ".build", "debug", "guerillaglass-engine");

  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(outputDirectory, { recursive: true });

  if (!skipBuild) {
    await run(["swift", "build", "--product", "guerillaglass-engine"]);
    await run(["bun", "run", "desktop:build"]);
  }
  for (const requiredPath of [launcherPath, enginePath]) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Required runtime artifact is missing: ${requiredPath}`);
    }
  }

  const consoleFile = openSync(consoleLogPath, "w");
  const subprocess = Bun.spawn([launcherPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      GG_DEBUG: "1",
      GG_ENGINE_PATH: enginePath,
      GG_DESKTOP_DIAGNOSTICS_LOG: diagnosticsLogPath,
    },
    detached: true,
    stdin: "ignore",
    stdout: consoleFile,
    stderr: consoleFile,
  });

  let window: WindowRecord | null = null;
  let screenshotStatus: "captured" | "unavailable" = "unavailable";
  let milestones = Object.fromEntries(
    startupMilestones.map((milestone) => [milestone, false]),
  ) as Record<(typeof startupMilestones)[number], boolean>;
  const errors: string[] = [];

  try {
    milestones = await waitForStartup(subprocess.pid, timeoutMs);
    window = await probeWindow();
    screenshotStatus = await captureWindow(window);
    await Bun.sleep(500);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const cleanupPassed = await stopProcessGroup(subprocess.pid);
  await subprocess.exited;
  closeSync(consoleFile);

  const combinedLogs = `${readText(consoleLogPath)}\n${readText(diagnosticsLogPath)}`;
  const fatalMatches = fatalPatterns
    .filter((pattern) => pattern.test(combinedLogs))
    .map((pattern) => pattern.source);
  for (const [milestone, passed] of Object.entries(milestones)) {
    if (!passed) {
      errors.push(`Startup milestone not observed: ${milestone}`);
    }
  }
  if (!window) {
    errors.push("No visible Guerillaglass desktop window was found.");
  }
  if (!cleanupPassed) {
    errors.push("Desktop process group did not stop within 10 seconds.");
  }
  if (fatalMatches.length > 0) {
    errors.push(`Fatal runtime log patterns found: ${fatalMatches.join(", ")}`);
  }
  if (requireScreenshot && screenshotStatus !== "captured") {
    errors.push(
      "Window screenshot unavailable. Grant Screen Recording permission to the invoking terminal or omit --require-screenshot.",
    );
  }

  const report: RuntimeSmokeReport = {
    status: errors.length === 0 ? "passed" : "failed",
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    appBundle,
    enginePath,
    milestones,
    window,
    screenshot: { status: screenshotStatus, path: screenshotPath },
    fatalMatches,
    cleanupPassed,
    errors,
  };
  writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(reportMarkdownPath, renderMarkdown(report));
  console.log(renderMarkdown(report));
  console.log(`Artifacts: ${path.relative(repoRoot, outputDirectory)}`);
  if (report.status === "failed") {
    process.exitCode = 1;
  }
}

await main();
