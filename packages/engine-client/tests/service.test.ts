import { expect, it } from "@effect/vitest";
import { EngineClientError, EngineResponseError } from "../src/errors";
import { describe } from "vitest";
import { Effect, Fiber, Layer, Option, Queue, Redacted } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse, Headers } from "effect/http";
import {
  agentJobIdSchema,
  agentPreflightTokenSchema,
  displayIdSchema,
  exportJobIdSchema,
  exportPresetIdSchema,
  outputUrlSchema,
  projectPathSchema,
  windowIdSchema,
} from "@guerillaglass/engine-contract/schema-primitives";
import { CaptureService, layerCaptureService } from "../src/services/CaptureService";
import { SystemService, layerSystemService } from "../src/services/SystemService";
import {
  EngineClient,
  makeBearerHttpClientTransform,
  makeEngineClientService,
  makeRawEngineHttpApiClient,
  type RawEngineHttpApiClient,
} from "../src/service";

describe("EngineClient service", () => {
  it.effect("decorates low-level HTTP requests with bearer auth", () =>
    Effect.gen(function* () {
      let authorization: Option.Option<string> = Option.none();
      const client = makeBearerHttpClientTransform(Redacted.make("token-123"))(
        HttpClient.make((request) =>
          Effect.sync(() => {
            authorization = Headers.get(request.headers, "authorization");
          }).pipe(Effect.flatMap(() => Effect.die("stop after request capture"))),
        ),
      );

      yield* Effect.exit(client.execute(HttpClientRequest.get("http://127.0.0.1/v1/system/ping")));
      expect(Option.getOrUndefined(authorization)).toBe("Bearer token-123");
    }),
  );

  it.effect("wraps every generated low-level client endpoint in stable method names", () =>
    Effect.gen(function* () {
      const calls: Array<{ readonly name: string; readonly request: unknown }> = [];
      const endpoint = (name: string) => (request: unknown) => {
        calls.push({ name, request });
        return Effect.die("endpoint dispatch captured; no response supplied");
      };
      const rawClient: RawEngineHttpApiClient = {
        system: {
          systemPing: endpoint("system.systemPing"),
          engineCapabilities: endpoint("system.engineCapabilities"),
        },
        agent: {
          agentPreflight: endpoint("agent.agentPreflight"),
          agentRun: endpoint("agent.agentRun"),
          agentStatus: endpoint("agent.agentStatus"),
          agentApply: endpoint("agent.agentApply"),
        },
        permissions: {
          permissionsGet: endpoint("permissions.permissionsGet"),
          permissionsRequestScreenRecording: endpoint(
            "permissions.permissionsRequestScreenRecording",
          ),
          permissionsRequestMicrophone: endpoint("permissions.permissionsRequestMicrophone"),
          permissionsRequestInputMonitoring: endpoint(
            "permissions.permissionsRequestInputMonitoring",
          ),
          permissionsOpenInputMonitoringSettings: endpoint(
            "permissions.permissionsOpenInputMonitoringSettings",
          ),
        },
        sources: { sourcesList: endpoint("sources.sourcesList") },
        capture: {
          captureStartDisplay: endpoint("capture.captureStartDisplay"),
          captureStartCurrentWindow: endpoint("capture.captureStartCurrentWindow"),
          captureStartWindow: endpoint("capture.captureStartWindow"),
          captureStop: endpoint("capture.captureStop"),
          captureStatus: endpoint("capture.captureStatus"),
          capturePreviewFrame: endpoint("capture.capturePreviewFrame"),
        },
        recording: {
          recordingStart: endpoint("recording.recordingStart"),
          recordingStop: endpoint("recording.recordingStop"),
        },
        export: {
          exportInfo: endpoint("export.exportInfo"),
          exportRun: endpoint("export.exportRun"),
          exportRunCutPlan: endpoint("export.exportRunCutPlan"),
          exportGet: endpoint("export.exportGet"),
        },
        project: {
          projectCurrent: endpoint("project.projectCurrent"),
          projectOpen: endpoint("project.projectOpen"),
          projectSave: endpoint("project.projectSave"),
          projectRecents: endpoint("project.projectRecents"),
        },
      };

      const client = makeEngineClientService(rawClient);
      yield* Effect.exit(client.systemPing);
      yield* Effect.exit(client.engineCapabilities);
      yield* Effect.exit(client.agentPreflight({}));
      yield* Effect.exit(
        client.agentRun({ preflightToken: agentPreflightTokenSchema.make("preflight-token") }),
      );
      yield* Effect.exit(client.agentStatus(agentJobIdSchema.make("agent-job")));
      yield* Effect.exit(
        client.agentApply(agentJobIdSchema.make("agent-job"), { destructiveIntent: true }),
      );
      yield* Effect.exit(client.permissionsGet);
      yield* Effect.exit(client.permissionsRequestScreenRecording);
      yield* Effect.exit(client.permissionsRequestMicrophone);
      yield* Effect.exit(client.permissionsRequestInputMonitoring);
      yield* Effect.exit(client.permissionsOpenInputMonitoringSettings);
      yield* Effect.exit(client.sourcesList);
      yield* Effect.exit(client.captureStartDisplay({ displayId: displayIdSchema.make(1) }));
      yield* Effect.exit(client.captureStartCurrentWindow({}));
      yield* Effect.exit(client.captureStartWindow({ windowId: windowIdSchema.make(2) }));
      yield* Effect.exit(client.captureStop);
      yield* Effect.exit(client.captureStatus);
      yield* Effect.exit(client.capturePreviewFrame);
      yield* Effect.exit(client.recordingStart({ trackInputEvents: true }));
      yield* Effect.exit(client.recordingStop);
      yield* Effect.exit(client.exportInfo);
      yield* Effect.exit(
        client.exportRun({
          outputURL: outputUrlSchema.make("file:///tmp/out.mp4"),
          presetId: exportPresetIdSchema.make("mp4-1080p"),
        }),
      );
      yield* Effect.exit(
        client.exportRunCutPlan({
          outputURL: outputUrlSchema.make("file:///tmp/cut-plan.mp4"),
          presetId: exportPresetIdSchema.make("mp4-1080p"),
          jobId: agentJobIdSchema.make("agent-job"),
        }),
      );
      yield* Effect.exit(client.exportGet(exportJobIdSchema.make("export-job")));
      yield* Effect.exit(client.projectCurrent);
      yield* Effect.exit(
        client.projectOpen({ projectPath: projectPathSchema.make("/tmp/project.ggproj") }),
      );
      yield* Effect.exit(
        client.projectSave({ projectPath: projectPathSchema.make("/tmp/project.ggproj") }),
      );
      yield* Effect.exit(client.projectRecents(5));

      expect(calls.map((call) => call.name).sort()).toEqual([
        "agent.agentApply",
        "agent.agentPreflight",
        "agent.agentRun",
        "agent.agentStatus",
        "capture.capturePreviewFrame",
        "capture.captureStartCurrentWindow",
        "capture.captureStartDisplay",
        "capture.captureStartWindow",
        "capture.captureStatus",
        "capture.captureStop",
        "export.exportGet",
        "export.exportInfo",
        "export.exportRun",
        "export.exportRunCutPlan",
        "permissions.permissionsGet",
        "permissions.permissionsOpenInputMonitoringSettings",
        "permissions.permissionsRequestInputMonitoring",
        "permissions.permissionsRequestMicrophone",
        "permissions.permissionsRequestScreenRecording",
        "project.projectCurrent",
        "project.projectOpen",
        "project.projectRecents",
        "project.projectSave",
        "recording.recordingStart",
        "recording.recordingStop",
        "sources.sourcesList",
        "system.engineCapabilities",
        "system.systemPing",
      ]);
      expect(calls).toContainEqual({
        name: "agent.agentApply",
        request: { params: { jobId: "agent-job" }, payload: { destructiveIntent: true } },
      });
      expect(calls).toContainEqual({
        name: "export.exportGet",
        request: { params: { jobId: "export-job" } },
      });
      expect(calls).toContainEqual({
        name: "project.projectRecents",
        request: { query: { limit: 5 } },
      });
    }),
  );

  it.effect("wraps a generated low-level client in stable method names", () =>
    Effect.gen(function* () {
      const rawClient = yield* makeRawEngineHttpApiClient({
        baseUrl: new URL("http://127.0.0.1"),
        bearerToken: Redacted.make("test-token"),
        requestTimeoutMs: 30_000,
      });
      const ping = yield* makeEngineClientService(rawClient).systemPing;
      expect(ping.protocolVersion).toBe("2");
    }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              Response.json({
                app: "guerillaglass",
                engineVersion: "0.0.0-test",
                protocolVersion: "2",
                platform: "test",
              }),
            ),
          ),
        ),
      ),
    ),
  );
  it.effect("preserves engine rejection codes as response errors", () =>
    Effect.gen(function* () {
      const raw = yield* makeRawEngineHttpApiClient({
        baseUrl: new URL("http://127.0.0.1"),
        bearerToken: Redacted.make("test"),
        requestTimeoutMs: 30_000,
      });
      const client = makeEngineClientService(raw);
      const rejection = yield* Effect.flip(client.systemPing);
      expect(rejection).toBeInstanceOf(EngineResponseError);
      expect(rejection.code).toBe("runtime_error");
    }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              Response.json(
                { code: "runtime_error", message: "Invalid engine request" },
                { status: 500 },
              ),
            ),
          ),
        ),
      ),
    ),
  );

  it.effect("reports malformed successful responses as client failures", () =>
    Effect.gen(function* () {
      const raw = yield* makeRawEngineHttpApiClient({
        baseUrl: new URL("http://127.0.0.1"),
        bearerToken: Redacted.make("test"),
        requestTimeoutMs: 30_000,
      });
      const failure = yield* Effect.flip(makeEngineClientService(raw).systemPing);
      expect(failure).toBeInstanceOf(EngineClientError);
      expect(failure.code).toBe("ENGINE_HTTP_REQUEST_FAILED");
    }).pipe(
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(request, Response.json({ protocolVersion: "2" })),
          ),
        ),
      ),
    ),
  );

  it.effect("derives domain services from EngineClient", () =>
    Effect.gen(function* () {
      const system = yield* SystemService;
      const ping = yield* system.ping;
      expect(ping.platform).toBe("test");
    }).pipe(
      Effect.provide(
        Layer.provide(
          layerSystemService,
          Layer.mock(EngineClient, {
            systemPing: Effect.succeed({
              app: "guerillaglass",
              engineVersion: "0.0.0-test",
              protocolVersion: "2",
              platform: "test",
            }),
            engineCapabilities: Effect.die("unused"),
          }),
        ),
      ),
    ),
  );
});

it.effect("dismisses an interrupted picker without stopping an interrupted direct capture", () =>
  Effect.gen(function* () {
    const started = yield* Queue.unbounded<number>();
    let stops = 0;
    const capture = yield* CaptureService.pipe(
      Effect.provide(
        layerCaptureService.pipe(
          Layer.provide(
            Layer.mock(EngineClient, {
              captureStartWindow: (request) =>
                Queue.offer(started, request.windowId).pipe(Effect.andThen(Effect.never)),
              captureStop: Effect.sync(() => {
                stops += 1;
                return {
                  isRunning: false,
                  isRecording: false,
                  recordingDurationSeconds: 0,
                  telemetry: {
                    sourceDroppedFrames: 0,
                    writerDroppedFrames: 0,
                    writerBackpressureDrops: 0,
                    achievedFps: 0,
                    captureCallbackMs: 0,
                    recordQueueLagMs: 0,
                    writerAppendMs: 0,
                  },
                };
              }),
            }),
          ),
        ),
      ),
    );
    const request = yield* capture
      .startWindow({ windowId: windowIdSchema.make(0) })
      .pipe(Effect.forkChild);
    expect(yield* Queue.take(started)).toBe(0);
    yield* Fiber.interrupt(request);
    expect(stops).toBe(1);
    const directRequest = yield* capture
      .startWindow({ windowId: windowIdSchema.make(42) })
      .pipe(Effect.forkChild);
    expect(yield* Queue.take(started)).toBe(42);
    yield* Fiber.interrupt(directRequest);
    expect(stops).toBe(1);
  }),
);
