import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type Request = {
  id: string;
  method: string;
  params?: Record<string, Json>;
};

type Response =
  | {
      id: string;
      ok: true;
      result: Json;
    }
  | {
      id: string;
      ok: false;
      error: {
        code:
          | "invalid_request"
          | "invalid_params"
          | "unsupported_method"
          | "permission_denied"
          | "needs_confirmation"
          | "qa_failed"
          | "missing_local_model"
          | "invalid_cut_plan"
          | "runtime_error";
        message: string;
      };
    };

type AgentJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled" | "blocked";
type AgentTranscriptionProvider = "none" | "imported_transcript";
type AgentBlockingReason =
  | "missing_project"
  | "missing_recording"
  | "invalid_runtime_budget"
  | "source_too_long"
  | "source_duration_invalid"
  | "missing_local_model"
  | "missing_imported_transcript"
  | "invalid_imported_transcript"
  | "no_audio_track"
  | "silent_audio"
  | "empty_transcript"
  | "weak_narrative_structure";

type AgentRunState = {
  jobId: string;
  status: AgentJobStatus;
  runtimeBudgetMinutes: number;
  blockingReason: AgentBlockingReason | null;
  updatedAt: string;
  qaReport: {
    passed: boolean;
    score: number;
    coverage: {
      hook: boolean;
      action: boolean;
      payoff: boolean;
      takeaway: boolean;
    };
    missingBeats: Array<"hook" | "action" | "payoff" | "takeaway">;
  } | null;
};

type ImportedTranscriptSegment = {
  text: string;
  startSeconds: number;
  endSeconds: number;
};

type ImportedTranscriptWord = {
  word: string;
  startSeconds: number;
  endSeconds: number;
};

type ImportedTranscript = {
  segments: ImportedTranscriptSegment[];
  words: ImportedTranscriptWord[];
};

type PreflightSession = {
  token: string;
  ready: boolean;
  runtimeBudgetMinutes: number;
  transcriptionProvider: AgentTranscriptionProvider;
  importedTranscriptPath: string;
  projectPath: string | null;
  recordingURL: string | null;
  createdAtMs: number;
};

type State = {
  isRunning: boolean;
  isRecording: boolean;
  recordingDurationSeconds: number;
  recordingURL: string | null;
  eventsURL: string | null;
  lastError: string | null;
  recordingStartedAt: number | null;
  projectPath: string | null;
  autoZoom: {
    isEnabled: boolean;
    intensity: number;
    minimumKeyframeInterval: number;
  };
  captureMetadata: {
    window: {
      id: number;
      title: string;
      appName: string;
    } | null;
    source: "display" | "window";
    contentRect: { x: number; y: number; width: number; height: number };
    pixelScale: number;
  } | null;
  recentProjects: Array<{
    projectPath: string;
    displayName: string;
    lastOpenedAt: string;
  }>;
  unsavedChanges: boolean;
  agentRuns: Record<string, AgentRunState>;
  preflightSessions: Record<string, PreflightSession>;
};

const state: State = {
  isRunning: false,
  isRecording: false,
  recordingDurationSeconds: 0,
  recordingURL: null,
  eventsURL: null,
  lastError: null,
  recordingStartedAt: null,
  projectPath: null,
  autoZoom: {
    isEnabled: false,
    intensity: 0.55,
    minimumKeyframeInterval: 0.15,
  },
  captureMetadata: null,
  recentProjects: [],
  unsavedChanges: false,
  agentRuns: {},
  preflightSessions: {},
};

const preflightTokenTTLms = 60_000;

function statusResult(): Json {
  const now = Date.now();
  const activeDuration =
    state.isRecording && state.recordingStartedAt != null
      ? (now - state.recordingStartedAt) / 1000
      : 0;

  return {
    isRunning: state.isRunning,
    isRecording: state.isRecording,
    recordingDurationSeconds: state.recordingDurationSeconds + activeDuration,
    recordingURL: state.recordingURL,
    captureMetadata: state.captureMetadata,
    lastError: state.lastError,
    eventsURL: state.eventsURL,
    telemetry: {
      totalFrames: 0,
      droppedFrames: 0,
      droppedFramePercent: 0,
      audioLevelDbfs: null,
      health: "good",
      healthReason: null,
    },
  };
}

function projectState(): Json {
  const latestRun = Object.values(state.agentRuns)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .at(0);

  return {
    projectPath: state.projectPath,
    recordingURL: state.recordingURL,
    eventsURL: state.eventsURL,
    autoZoom: state.autoZoom,
    captureMetadata: state.captureMetadata,
    agentAnalysis: {
      latestJobId: latestRun?.jobId ?? null,
      latestStatus: latestRun?.status ?? null,
      qaPassed: latestRun?.qaReport?.passed ?? null,
      updatedAt: latestRun?.updatedAt ?? null,
    },
  };
}

function stubAgentRunState(
  jobId: string,
  runtimeBudgetMinutes: number,
  coverage: { hook: boolean; action: boolean; payoff: boolean; takeaway: boolean },
  blockingReason: AgentBlockingReason | null = "weak_narrative_structure",
): AgentRunState {
  const coveredCount = Object.values(coverage).filter(Boolean).length;
  const passed = coveredCount === 4;
  const score = coveredCount / 4;
  const missingBeats = (["hook", "action", "payoff", "takeaway"] as const).filter(
    (beat) => !coverage[beat],
  );

  return {
    jobId,
    status: passed ? "completed" : "blocked",
    runtimeBudgetMinutes,
    blockingReason: passed ? null : blockingReason,
    updatedAt: new Date().toISOString(),
    qaReport: {
      passed,
      score,
      coverage,
      missingBeats,
    },
  };
}

function transcriptionProviderFromParams(params: Record<string, Json>): AgentTranscriptionProvider {
  return params.transcriptionProvider === "imported_transcript" ? "imported_transcript" : "none";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeSegment(entry: unknown): ImportedTranscriptSegment | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const candidate = entry as Record<string, unknown>;
  const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const start =
    asNumber(candidate.startSeconds) ??
    asNumber(candidate.start) ??
    asNumber(candidate.start_time_seconds);
  const end =
    asNumber(candidate.endSeconds) ?? asNumber(candidate.end) ?? asNumber(candidate.end_time_seconds);
  if (!text || start == null || end == null || start < 0 || end <= start) {
    return null;
  }
  return { text, startSeconds: start, endSeconds: end };
}

function normalizeWord(entry: unknown): ImportedTranscriptWord | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const candidate = entry as Record<string, unknown>;
  const word = typeof candidate.word === "string" ? candidate.word.trim() : "";
  const start =
    asNumber(candidate.startSeconds) ??
    asNumber(candidate.start) ??
    asNumber(candidate.start_time_seconds);
  const end =
    asNumber(candidate.endSeconds) ?? asNumber(candidate.end) ?? asNumber(candidate.end_time_seconds);
  if (!word || start == null || end == null || start < 0 || end <= start) {
    return null;
  }
  return { word, startSeconds: start, endSeconds: end };
}

function parseImportedTranscript(path: string): ImportedTranscript | null {
  if (!path || !existsSync(path)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as {
      segments?: unknown[];
      words?: unknown[];
    };
    const segments = Array.isArray(parsed.segments)
      ? parsed.segments.map(normalizeSegment).filter((entry): entry is ImportedTranscriptSegment => entry != null)
      : [];
    const words = Array.isArray(parsed.words)
      ? parsed.words.map(normalizeWord).filter((entry): entry is ImportedTranscriptWord => entry != null)
      : [];
    if (segments.length === 0 && words.length === 0) {
      return null;
    }
    return { segments, words };
  } catch {
    return null;
  }
}

function hasValidImportedTranscript(path: string): boolean {
  return parseImportedTranscript(path) != null;
}

function tokenizeTranscript(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length > 0),
  );
}

function hasAny(tokens: Set<string>, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => tokens.has(candidate));
}

function transcriptText(transcript: ImportedTranscript): string {
  return [...transcript.segments.map((segment) => segment.text), ...transcript.words.map((word) => word.word)].join(
    " ",
  );
}

function inferBeatCoverage(transcript: ImportedTranscript) {
  const tokens = tokenizeTranscript(transcriptText(transcript));
  return {
    hook: hasAny(tokens, ["hook", "intro", "opening"]),
    action: hasAny(tokens, ["action", "step", "steps", "process"]),
    payoff: hasAny(tokens, ["payoff", "result", "outcome"]),
    takeaway: hasAny(tokens, ["takeaway", "lesson", "conclusion"]),
  };
}

function preflightFingerprint(params: Record<string, Json>) {
  const runtimeBudgetMinutes =
    typeof params.runtimeBudgetMinutes === "number" && Number.isFinite(params.runtimeBudgetMinutes)
      ? Math.floor(params.runtimeBudgetMinutes)
      : 10;
  const transcriptionProvider = transcriptionProviderFromParams(params);
  const importedTranscriptPath =
    typeof params.importedTranscriptPath === "string" ? params.importedTranscriptPath : "";
  return {
    runtimeBudgetMinutes,
    transcriptionProvider,
    importedTranscriptPath,
    projectPath: state.projectPath,
    recordingURL: state.recordingURL,
  };
}

function agentPreflightResult(params: Record<string, Json>) {
  const {
    runtimeBudgetMinutes,
    transcriptionProvider,
    importedTranscriptPath,
    projectPath,
    recordingURL,
  } = preflightFingerprint(params);
  const blockingReasons: AgentBlockingReason[] = [];

  if (runtimeBudgetMinutes < 1 || runtimeBudgetMinutes > 10) {
    blockingReasons.push("invalid_runtime_budget");
  }
  if (!state.projectPath) {
    blockingReasons.push("missing_project");
  }
  if (!state.recordingURL) {
    blockingReasons.push("missing_recording");
  }
  if (transcriptionProvider === "none") {
    blockingReasons.push("missing_local_model");
  } else if (!importedTranscriptPath) {
    blockingReasons.push("missing_imported_transcript");
  } else if (!hasValidImportedTranscript(importedTranscriptPath)) {
    blockingReasons.push("invalid_imported_transcript");
  }

  const ready = blockingReasons.length === 0;
  const preflightToken = ready ? crypto.randomUUID() : null;
  if (preflightToken) {
    state.preflightSessions[preflightToken] = {
      token: preflightToken,
      ready,
      runtimeBudgetMinutes,
      transcriptionProvider,
      importedTranscriptPath,
      projectPath,
      recordingURL,
      createdAtMs: Date.now(),
    };
  }

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    canApplyDestructive: state.unsavedChanges,
    transcriptionProvider,
    preflightToken,
  };
}

function recordRecentProject(projectPath: string): void {
  const normalizedPath = projectPath.trim();
  if (!normalizedPath) {
    return;
  }
  const displayName =
    normalizedPath.split(/[\\/]/).pop()?.replace(/\.gglassproj$/i, "") || normalizedPath;
  state.recentProjects = [
    {
      projectPath: normalizedPath,
      displayName,
      lastOpenedAt: new Date().toISOString(),
    },
    ...state.recentProjects.filter((item) => item.projectPath !== normalizedPath),
  ].slice(0, 20);
}

function success(id: string, result: Json): Response {
  return { id, ok: true, result };
}

function failure(
  id: string,
  code: Response extends { ok: false; error: { code: infer C } } ? C : never,
  message: string,
): Response {
  return {
    id,
    ok: false,
    error: { code, message },
  };
}

function writeResponse(response: Response): void {
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function handleRequest(platform: string, request: Request): Response {
  const params = request.params ?? {};

  switch (request.method) {
    case "system.ping":
      return success(request.id, {
        app: "guerillaglass",
        engineVersion: "0.1.0-stub",
        protocolVersion: "2",
        platform,
      });

    case "engine.capabilities":
      return success(request.id, {
        protocolVersion: "2",
        platform,
        phase: "stub",
        capture: {
          display: true,
          window: true,
          systemAudio: false,
          microphone: true,
        },
        recording: {
          inputTracking: true,
        },
        export: {
          presets: true,
          cutPlan: true,
        },
        project: {
          openSave: true,
        },
        agent: {
          preflight: true,
          run: true,
          status: true,
          apply: true,
          localOnly: true,
          runtimeBudgetMinutes: 10,
        },
      });

    case "agent.preflight":
      return success(request.id, agentPreflightResult(params));

    case "agent.run": {
      const preflightToken = typeof params.preflightToken === "string" ? params.preflightToken : "";
      if (!preflightToken) {
        return failure(
          request.id,
          "invalid_params",
          "agent.preflight must be called first. preflightToken is required.",
        );
      }
      const session = state.preflightSessions[preflightToken];
      if (!session) {
        return failure(
          request.id,
          "invalid_params",
          "preflightToken is missing or expired. Run agent.preflight again.",
        );
      }
      if (Date.now() - session.createdAtMs > preflightTokenTTLms) {
        delete state.preflightSessions[preflightToken];
        return failure(
          request.id,
          "invalid_params",
          "preflightToken expired. Run agent.preflight again.",
        );
      }
      const fingerprint = preflightFingerprint(params);
      const fingerprintMatches =
        session.ready &&
        session.runtimeBudgetMinutes === fingerprint.runtimeBudgetMinutes &&
        session.transcriptionProvider === fingerprint.transcriptionProvider &&
        session.importedTranscriptPath === fingerprint.importedTranscriptPath &&
        session.projectPath === fingerprint.projectPath &&
        session.recordingURL === fingerprint.recordingURL;
      if (!fingerprintMatches) {
        delete state.preflightSessions[preflightToken];
        return failure(
          request.id,
          "invalid_params",
          "preflightToken does not match current run parameters. Run agent.preflight again.",
        );
      }
      delete state.preflightSessions[preflightToken];

      const runtimeBudgetMinutes =
        typeof params.runtimeBudgetMinutes === "number" && Number.isFinite(params.runtimeBudgetMinutes)
          ? Math.floor(params.runtimeBudgetMinutes)
          : 10;
      if (runtimeBudgetMinutes < 1 || runtimeBudgetMinutes > 10) {
        return failure(
          request.id,
          "invalid_params",
          "runtimeBudgetMinutes must be between 1 and 10",
        );
      }
      const forceRequested = params.force === true;
      if (forceRequested && process.env.GG_AGENT_ALLOW_FORCE !== "1") {
        return failure(
          request.id,
          "invalid_params",
          "force is disabled for production runs. Set GG_AGENT_ALLOW_FORCE=1 for local debugging.",
        );
      }
      const jobId = crypto.randomUUID();
      const transcriptionProvider = transcriptionProviderFromParams(params);
      const importedTranscriptPath =
        typeof params.importedTranscriptPath === "string" ? params.importedTranscriptPath : "";
      const transcript =
        transcriptionProvider === "imported_transcript"
          ? parseImportedTranscript(importedTranscriptPath)
          : null;
      const transcriptTokenCount = transcript ? tokenizeTranscript(transcriptText(transcript)).size : 0;
      const coverage = forceRequested
        ? { hook: true, action: true, payoff: true, takeaway: true }
        : transcript
          ? inferBeatCoverage(transcript)
          : {
              hook: true,
              action: state.recordingDurationSeconds >= 15,
              payoff: state.recordingDurationSeconds >= 30,
              takeaway: state.recordingDurationSeconds >= 45,
            };
      const blockingReason: AgentBlockingReason | null =
        !forceRequested && transcript && transcriptTokenCount === 0
          ? "empty_transcript"
          : !forceRequested && Object.values(coverage).some((value) => !value)
            ? "weak_narrative_structure"
            : null;
      const run = stubAgentRunState(jobId, runtimeBudgetMinutes, coverage, blockingReason);
      state.agentRuns[jobId] = run;
      state.unsavedChanges = true;
      return success(request.id, { jobId, status: run.status });
    }

    case "agent.status": {
      const jobId = typeof params.jobId === "string" ? params.jobId : "";
      if (!jobId) {
        return failure(request.id, "invalid_params", "jobId is required");
      }
      const run = state.agentRuns[jobId];
      if (!run) {
        return failure(request.id, "invalid_params", `Unknown jobId: ${jobId}`);
      }
      return success(request.id, {
        jobId: run.jobId,
        status: run.status,
        runtimeBudgetMinutes: run.runtimeBudgetMinutes,
        qaReport: run.qaReport,
        blockingReason: run.blockingReason,
        updatedAt: run.updatedAt,
      });
    }

    case "agent.apply": {
      const jobId = typeof params.jobId === "string" ? params.jobId : "";
      const destructiveIntent = params.destructiveIntent === true;
      if (!jobId) {
        return failure(request.id, "invalid_params", "jobId is required");
      }
      const run = state.agentRuns[jobId];
      if (!run) {
        return failure(request.id, "invalid_params", `Unknown jobId: ${jobId}`);
      }
      if (run.qaReport?.passed !== true) {
        return failure(request.id, "qa_failed", "Narrative QA failed. Apply is blocked.");
      }
      if (state.unsavedChanges && !destructiveIntent) {
        return failure(
          request.id,
          "needs_confirmation",
          "Unsaved project changes detected. Retry with destructiveIntent=true to continue.",
        );
      }
      state.unsavedChanges = true;
      return success(request.id, {
        success: true,
        message: "Applied cut plan to working timeline.",
      });
    }

    case "permissions.get":
      return success(request.id, {
        screenRecordingGranted: true,
        microphoneGranted: true,
        inputMonitoring: "authorized",
      });

    case "permissions.requestScreenRecording":
    case "permissions.requestMicrophone":
    case "permissions.requestInputMonitoring":
    case "permissions.openInputMonitoringSettings":
      return success(request.id, {
        success: true,
        message: "Stub engine: simulated success.",
      });

    case "sources.list":
      return success(request.id, {
        displays: [{ id: 1, width: 1920, height: 1080 }],
        windows: [
          {
            id: 101,
            title: "Stub Window",
            appName: "StubApp",
            width: 1280,
            height: 720,
            isOnScreen: true,
          },
        ],
      });

    case "capture.startDisplay":
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: null,
        source: "display",
        contentRect: { x: 0, y: 0, width: 1920, height: 1080 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());

    case "capture.startCurrentWindow":
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: {
          id: 101,
          title: "Stub Window",
          appName: "StubApp",
        },
        source: "window",
        contentRect: { x: 0, y: 0, width: 1280, height: 720 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());

    case "capture.startWindow": {
      const requestedWindowId =
        typeof params.windowId === "number" && Number.isFinite(params.windowId)
          ? Math.max(0, Math.floor(params.windowId))
          : 101;
      state.isRunning = true;
      state.lastError = null;
      state.captureMetadata = {
        window: {
          id: requestedWindowId,
          title: "Stub Window",
          appName: "StubApp",
        },
        source: "window",
        contentRect: { x: 0, y: 0, width: 1280, height: 720 },
        pixelScale: 1,
      };
      return success(request.id, statusResult());
    }

    case "capture.stop":
      if (state.isRecording && state.recordingStartedAt != null) {
        state.recordingDurationSeconds += (Date.now() - state.recordingStartedAt) / 1000;
      }
      state.recordingStartedAt = null;
      state.isRecording = false;
      state.isRunning = false;
      return success(request.id, statusResult());

    case "recording.start":
      if (!state.isRunning) {
        return failure(request.id, "invalid_params", "Start capture before recording.");
      }
      state.isRecording = true;
      state.recordingStartedAt = Date.now();
      state.recordingURL = "stub://recordings/session.mp4";
      state.eventsURL = params.trackInputEvents === true ? "stub://events/session-events.json" : null;
      state.lastError = null;
      return success(request.id, statusResult());

    case "recording.stop":
      if (state.isRecording && state.recordingStartedAt != null) {
        state.recordingDurationSeconds += (Date.now() - state.recordingStartedAt) / 1000;
      }
      state.recordingStartedAt = null;
      state.isRecording = false;
      state.unsavedChanges = true;
      return success(request.id, statusResult());

    case "capture.status":
      return success(request.id, statusResult());

    case "export.info":
      return success(request.id, {
        presets: [
          {
            id: "stub-1080p30",
            name: "Stub 1080p 30",
            width: 1920,
            height: 1080,
            fps: 30,
            fileType: "mp4",
          },
        ],
      });

    case "export.run": {
      const outputURL = typeof params.outputURL === "string" ? params.outputURL : "";
      if (!outputURL) {
        return failure(request.id, "invalid_params", "outputURL is required");
      }
      return success(request.id, { outputURL });
    }

    case "export.runCutPlan": {
      const outputURL = typeof params.outputURL === "string" ? params.outputURL : "";
      const presetId = typeof params.presetId === "string" ? params.presetId : "";
      const jobId = typeof params.jobId === "string" ? params.jobId : "";
      if (!outputURL) {
        return failure(request.id, "invalid_params", "outputURL is required");
      }
      if (!presetId) {
        return failure(request.id, "invalid_params", "presetId is required");
      }
      if (!jobId) {
        return failure(request.id, "invalid_params", "jobId is required");
      }
      const run = state.agentRuns[jobId];
      if (!run) {
        return failure(request.id, "invalid_params", `Unknown jobId: ${jobId}`);
      }
      if (run.qaReport?.passed !== true) {
        return failure(request.id, "qa_failed", "Narrative QA failed. Cut-plan export is blocked.");
      }
      const appliedSegments = run.qaReport
        ? ["hook", "action", "payoff", "takeaway"].filter(
            (beat) => run.qaReport?.coverage[beat as keyof typeof run.qaReport.coverage],
          ).length
        : 0;
      if (appliedSegments <= 0) {
        return failure(request.id, "invalid_cut_plan", "Cut plan artifact is missing.");
      }
      return success(request.id, { outputURL, appliedSegments });
    }

    case "project.current":
      return success(request.id, projectState());

    case "project.open": {
      const projectPath = typeof params.projectPath === "string" ? params.projectPath : "";
      if (!projectPath) {
        return failure(request.id, "invalid_params", "projectPath is required");
      }
      state.projectPath = projectPath;
      state.unsavedChanges = false;
      recordRecentProject(projectPath);
      return success(request.id, projectState());
    }

    case "project.save": {
      const projectPath = typeof params.projectPath === "string" ? params.projectPath : null;
      if (projectPath) {
        state.projectPath = projectPath;
        recordRecentProject(projectPath);
      }
      const autoZoom = params.autoZoom;
      if (autoZoom && typeof autoZoom === "object" && !Array.isArray(autoZoom)) {
        const cast = autoZoom as {
          isEnabled?: boolean;
          intensity?: number;
          minimumKeyframeInterval?: number;
        };
        state.autoZoom = {
          isEnabled: cast.isEnabled ?? state.autoZoom.isEnabled,
          intensity: cast.intensity ?? state.autoZoom.intensity,
          minimumKeyframeInterval:
            cast.minimumKeyframeInterval ?? state.autoZoom.minimumKeyframeInterval,
        };
      }
      state.unsavedChanges = false;
      return success(request.id, projectState());
    }

    case "project.recents": {
      const requestedLimit = typeof params.limit === "number" ? Math.floor(params.limit) : 10;
      const limit = Math.min(Math.max(requestedLimit, 1), 100);
      return success(request.id, { items: state.recentProjects.slice(0, limit) });
    }

    default:
      return failure(request.id, "unsupported_method", `Unsupported method: ${request.method}`);
  }
}

export function runStubEngine(platform: string): void {
  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on("line", (line) => {
    const raw = line.trim();
    if (!raw) {
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      writeResponse(failure("unknown", "invalid_request", "Invalid JSON"));
      return;
    }

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("id" in parsed) ||
      !("method" in parsed) ||
      typeof (parsed as { id?: unknown }).id !== "string" ||
      typeof (parsed as { method?: unknown }).method !== "string"
    ) {
      writeResponse(failure("unknown", "invalid_request", "Malformed request envelope"));
      return;
    }

    const request = parsed as Request;
    writeResponse(handleRequest(platform, request));
  });
}
