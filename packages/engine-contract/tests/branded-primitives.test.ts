import { describe, expect, expectTypeOf, test } from "vitest";
import { Schema } from "effect";
import {
  agentJobIdSchema,
  agentPreflightTokenSchema,
  artifactPathSchema,
  captureSessionIdSchema,
  displayIdSchema,
  eventsUrlSchema,
  exportJobIdSchema,
  exportPresetIdSchema,
  filePathSchema,
  isoDateTimeSchema,
  outputUrlSchema,
  projectPathSchema,
  recordingUrlSchema,
  reviewAuthTokenSchema,
  reviewCommentIdSchema,
  reviewIdSchema,
  reviewUserIdSchema,
  timelineSegmentIdSchema,
  windowIdSchema,
  type FilePath,
  type ProjectPath,
} from "../src/schema-primitives";

const acceptsProjectPath = (_value: ProjectPath): void => undefined;

const brandedSchemas = [
  [captureSessionIdSchema, "CaptureSessionId"],
  [projectPathSchema, "ProjectPath"],
  [filePathSchema, "FilePath"],
  [outputUrlSchema, "OutputUrl"],
  [recordingUrlSchema, "RecordingUrl"],
  [eventsUrlSchema, "EventsUrl"],
  [exportPresetIdSchema, "ExportPresetId"],
  [timelineSegmentIdSchema, "TimelineSegmentId"],
  [agentJobIdSchema, "AgentJobId"],
  [agentPreflightTokenSchema, "AgentPreflightToken"],
  [exportJobIdSchema, "ExportJobId"],
  [reviewIdSchema, "ReviewId"],
  [reviewCommentIdSchema, "ReviewCommentId"],
  [reviewUserIdSchema, "ReviewUserId"],
  [reviewAuthTokenSchema, "ReviewAuthToken"],
  [artifactPathSchema, "ArtifactPath"],
  [displayIdSchema, "DisplayId"],
  [windowIdSchema, "WindowId"],
  [isoDateTimeSchema, "IsoDateTime"],
] as const;

describe("branded schema primitives", () => {
  test.each(brandedSchemas)("records nominal brand metadata", (schema, brand) => {
    expect(Schema.resolveAnnotations(schema)?.brands).toContain(brand);
  });

  test("preserves the underlying runtime constraints", () => {
    expect(() => recordingUrlSchema.make("")).toThrow();
    expect(() => displayIdSchema.make(-1)).toThrow();
  });

  test("keeps brands decoded-only while preserving wire encodings", () => {
    const projectPath = Schema.decodeUnknownSync(projectPathSchema)("/tmp/project.ggproj");
    expect(projectPath).toBe("/tmp/project.ggproj");
    expect(Schema.encodeSync(projectPathSchema)(projectPath)).toBe("/tmp/project.ggproj");
    expectTypeOf(projectPath).toEqualTypeOf<ProjectPath>();
  });

  test("prevents structurally identical domain values from being mixed", () => {
    const projectPath = projectPathSchema.make("/tmp/project.ggproj");
    const filePath = filePathSchema.make("/tmp/recording.mov");
    acceptsProjectPath(projectPath);
    // @ts-expect-error FilePath and ProjectPath are intentionally nominally distinct.
    const invalidProjectPath: ProjectPath = filePath;
    expect(invalidProjectPath).toBe(filePath);
    expectTypeOf(filePath).toEqualTypeOf<FilePath>();
  });
});
