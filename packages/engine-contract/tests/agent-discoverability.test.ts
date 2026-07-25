import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  agentApplyResultSchema,
  agentCutPlanSummarySchema,
  agentPreflightResultSchema,
  agentStatusResultSchema,
} from "../src/domains/agent";
import { agentPreflightPayloadSchema } from "../src/httpApi";
import { EngineOpenApi } from "../src/openApi";

const qaReport = {
  passed: true,
  score: 1,
  coverage: { hook: true, action: true, payoff: true, takeaway: true },
  missingBeats: [],
};

describe("Agent Mode discoverability contract", () => {
  it("matches the native runtime budget limit", () => {
    expect(
      Schema.decodeUnknownSync(agentPreflightPayloadSchema)({ runtimeBudgetMinutes: 10 }),
    ).toEqual({ runtimeBudgetMinutes: 10 });
    expect(() =>
      Schema.decodeUnknownSync(agentPreflightPayloadSchema)({ runtimeBudgetMinutes: 11 }),
    ).toThrow();
  });

  it("exposes token expiry only with a ready preflight response", () => {
    const ready = Schema.decodeUnknownSync(agentPreflightResultSchema)({
      ready: true,
      blockingReasons: [],
      canApplyDestructive: false,
      transcriptionProvider: "imported_transcript",
      preflightToken: "token",
      preflightTokenExpiresAt: "2026-07-25T12:00:00Z",
    });
    expect("preflightToken" in ready && ready.preflightToken).toBe("token");

    const blocked = Schema.decodeUnknownSync(agentPreflightResultSchema)({
      ready: false,
      blockingReasons: ["missing_project"],
      canApplyDestructive: false,
      transcriptionProvider: "none",
    });
    expect("preflightToken" in blocked).toBe(false);
    expect(() =>
      Schema.decodeUnknownSync(agentPreflightResultSchema)({
        ready: true,
        blockingReasons: [],
        canApplyDestructive: false,
        transcriptionProvider: "imported_transcript",
      }),
    ).toThrow();
  });

  it("returns reviewable artifacts and an end-exclusive cut plan", () => {
    const result = Schema.decodeUnknownSync(agentStatusResultSchema)({
      jobId: "agent-1",
      status: "completed",
      runtimeBudgetMinutes: 10,
      qaReport,
      artifacts: [
        { kind: "cut-plan.v1", path: "analysis/cut-plan.v1.json" },
        { kind: "run-summary.v1", path: "analysis/run-summary.v1.json" },
      ],
      cutPlan: {
        version: 1,
        sourceFps: { numerator: 30_000, denominator: 1001 },
        sourceFrameCount: 300,
        segments: [
          { id: "agent-hook-0", beat: "hook", startFrame: 0, endFrame: 30 },
          { id: "agent-action-1", beat: "action", startFrame: 30, endFrame: 60 },
          { id: "agent-payoff-2", beat: "payoff", startFrame: 60, endFrame: 90 },
          { id: "agent-takeaway-3", beat: "takeaway", startFrame: 90, endFrame: 120 },
        ],
      },
      updatedAt: "2026-07-25T12:00:00Z",
    });
    expect(result.cutPlan?.segments[0]).toMatchObject({ startFrame: 0, endFrame: 30 });
    expect(() =>
      Schema.decodeUnknownSync(agentStatusResultSchema)({
        jobId: "agent-1",
        status: "completed",
        runtimeBudgetMinutes: 10,
        artifacts: [{ kind: "cut-plan.v1", path: "/tmp/cut-plan.v1.json" }],
        updatedAt: "2026-07-25T12:00:00Z",
      }),
    ).toThrow();
  });

  it("rejects non-canonical or overlapping cut plans", () => {
    const base = {
      version: 1,
      sourceFps: { numerator: 30, denominator: 1 },
      sourceFrameCount: 120,
      segments: [
        { id: "hook", beat: "hook", startFrame: 0, endFrame: 30 },
        { id: "action", beat: "action", startFrame: 30, endFrame: 60 },
        { id: "payoff", beat: "payoff", startFrame: 60, endFrame: 90 },
        { id: "takeaway", beat: "takeaway", startFrame: 90, endFrame: 120 },
      ],
    } as const;
    expect(Schema.decodeUnknownSync(agentCutPlanSummarySchema)(base).segments).toHaveLength(4);
    expect(() =>
      Schema.decodeUnknownSync(agentCutPlanSummarySchema)({
        ...base,
        segments: base.segments.map((segment, index) =>
          index === 1 ? { ...segment, startFrame: 20 } : segment,
        ),
      }),
    ).toThrow();
    expect(() =>
      Schema.decodeUnknownSync(agentCutPlanSummarySchema)({
        ...base,
        segments: base.segments.map((segment, index) =>
          index === 3 ? { ...segment, id: "payoff", beat: "payoff" } : segment,
        ),
      }),
    ).toThrow();
  });

  it("requires a verifiable successful apply result", () => {
    expect(
      Schema.decodeUnknownSync(agentApplyResultSchema)({
        success: true,
        jobId: "agent-1",
        status: "applied",
        appliedSegments: 4,
        projectHasUnsavedChanges: true,
      }),
    ).toMatchObject({ appliedSegments: 4, status: "applied" });
    expect(() =>
      Schema.decodeUnknownSync(agentApplyResultSchema)({
        success: true,
        jobId: "agent-1",
        status: "applied",
        appliedSegments: 0,
        projectHasUnsavedChanges: true,
      }),
    ).toThrow();
  });

  it("documents Agent workflow semantics and exact error statuses in OpenAPI", () => {
    const document = EngineOpenApi as {
      paths: Record<
        string,
        Record<string, { summary?: string; description?: string; responses: object }>
      >;
    };
    const preflight = document.paths["/v1/agent/preflight"]?.post;
    const run = document.paths["/v1/agent/runs"]?.post;
    const apply = document.paths["/v1/agent/runs/{jobId}/apply"]?.post;
    const cutPlanExport = document.paths["/v1/exports/from-cut-plan"]?.post;

    expect(preflight?.summary).toBe("Validate Agent Mode prerequisites");
    expect(preflight?.description).toContain("short-lived token");
    expect(Object.keys(preflight?.responses ?? {})).not.toEqual(
      expect.arrayContaining(["409", "422"]),
    );
    expect(Object.keys(run?.responses ?? {})).toEqual(
      expect.arrayContaining(["200", "400", "409", "422"]),
    );
    expect(Object.keys(apply?.responses ?? {})).toEqual(
      expect.arrayContaining(["404", "409", "422"]),
    );
    expect(JSON.stringify(EngineOpenApi)).toContain("project_mismatch");
    expect(JSON.stringify(EngineOpenApi)).toContain("preflight_expired");
    expect(Object.keys(cutPlanExport?.responses ?? {})).toContain("404");
  });
});
