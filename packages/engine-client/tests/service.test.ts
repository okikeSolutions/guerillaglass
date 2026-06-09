import { describe, expect, test } from "vitest";
import { Effect, Layer, Option, Redacted } from "effect";
import { HttpClient, HttpClientRequest, Headers } from "effect/unstable/http";
import { SystemService, layerSystemService } from "../src/services/SystemService";
import {
  EngineClient,
  makeBearerHttpClientTransform,
  makeEngineClientService,
  type RawEngineHttpApiClient,
} from "../src/service";

describe("EngineClient service", () => {
  test("decorates low-level HTTP requests with bearer auth", async () => {
    let authorization: unknown;
    const client = makeBearerHttpClientTransform(Redacted.make("token-123"))(
      HttpClient.make((request) =>
        Effect.sync(() => {
          authorization = Headers.get(request.headers, "authorization");
        }).pipe(Effect.flatMap(() => Effect.die("stop after request capture"))),
      ),
    );

    await Effect.runPromiseExit(
      client.execute(HttpClientRequest.get("http://127.0.0.1/v1/system/ping")),
    );

    expect(Option.getOrUndefined(authorization as Option.Option<string>)).toBe("Bearer token-123");
  });

  test("wraps every generated low-level client endpoint in stable method names", async () => {
    const calls: Array<{ readonly name: string; readonly request: unknown }> = [];
    const endpoint = (name: string) => (request: unknown) => {
      calls.push({ name, request });
      return Effect.succeed({ endpoint: name, request });
    };
    const rawClient = {
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
    } as unknown as RawEngineHttpApiClient;

    const client = makeEngineClientService(rawClient);
    await Promise.all([
      Effect.runPromise(client.systemPing),
      Effect.runPromise(client.engineCapabilities),
      Effect.runPromise(client.agentPreflight({ transcript: "ok" })),
      Effect.runPromise(client.agentRun({ prompt: "cut" })),
      Effect.runPromise(client.agentStatus("agent-job")),
      Effect.runPromise(client.agentApply("agent-job", { confirmed: true })),
      Effect.runPromise(client.permissionsGet),
      Effect.runPromise(client.permissionsRequestScreenRecording),
      Effect.runPromise(client.permissionsRequestMicrophone),
      Effect.runPromise(client.permissionsRequestInputMonitoring),
      Effect.runPromise(client.permissionsOpenInputMonitoringSettings),
      Effect.runPromise(client.sourcesList),
      Effect.runPromise(client.captureStartDisplay({ displayId: 1 })),
      Effect.runPromise(client.captureStartCurrentWindow({})),
      Effect.runPromise(client.captureStartWindow({ windowId: 2 })),
      Effect.runPromise(client.captureStop),
      Effect.runPromise(client.captureStatus),
      Effect.runPromise(client.capturePreviewFrame),
      Effect.runPromise(client.recordingStart({ trackInputEvents: true })),
      Effect.runPromise(client.recordingStop),
      Effect.runPromise(client.exportInfo),
      Effect.runPromise(client.exportRun({ outputURL: "file:///tmp/out.mp4" })),
      Effect.runPromise(client.exportRunCutPlan({ jobId: "agent-job" })),
      Effect.runPromise(client.exportGet("export-job")),
      Effect.runPromise(client.projectCurrent),
      Effect.runPromise(client.projectOpen({ projectURL: "file:///tmp/project.ggproj" })),
      Effect.runPromise(client.projectSave({ projectURL: "file:///tmp/project.ggproj" })),
      Effect.runPromise(client.projectRecents(5)),
    ]);

    expect(calls).toContainEqual({
      name: "agent.agentApply",
      request: { params: { jobId: "agent-job" }, payload: { confirmed: true } },
    });
    expect(calls).toContainEqual({
      name: "export.exportGet",
      request: { params: { jobId: "export-job" } },
    });
    expect(calls).toContainEqual({
      name: "project.projectRecents",
      request: { query: { limit: 5 } },
    });
    expect(calls.map((call) => call.name)).toContain("permissions.permissionsGet");
  });

  test("wraps a generated low-level client in stable method names", async () => {
    const emptyGroup = new Proxy({}, { get: () => () => Effect.succeed({}) });
    const rawClient = {
      system: {
        systemPing: (request: unknown) =>
          Effect.succeed({
            request,
            app: "guerillaglass",
            engineVersion: "0.0.0-test",
            protocolVersion: "2",
            platform: "test",
          }),
        engineCapabilities: () => Effect.succeed({}),
      },
      agent: emptyGroup,
      permissions: emptyGroup,
      sources: emptyGroup,
      capture: emptyGroup,
      recording: emptyGroup,
      export: emptyGroup,
      project: emptyGroup,
    } as unknown as RawEngineHttpApiClient;

    const client = makeEngineClientService(rawClient);
    const ping = await Effect.runPromise(client.systemPing);

    expect(ping.protocolVersion).toBe("2");
  });

  test("derives domain services from EngineClient", async () => {
    const effect = Effect.gen(function* () {
      const system = yield* SystemService;
      const ping = yield* system.ping;
      return ping;
    });

    const ping = await Effect.runPromise(
      effect.pipe(
        Effect.provide(
          Layer.provide(
            layerSystemService,
            Layer.succeed(EngineClient, {
              systemPing: Effect.succeed({
                app: "guerillaglass",
                engineVersion: "0.0.0-test",
                protocolVersion: "2",
                platform: "test",
              }),
              engineCapabilities: Effect.die("unused"),
            } as never),
          ),
        ),
      ),
    );

    expect(ping.platform).toBe("test");
  });
});
