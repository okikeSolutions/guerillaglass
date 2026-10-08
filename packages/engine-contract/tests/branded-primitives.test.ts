import { describe, expect, expectTypeOf, test } from "vitest";
import { Schema } from "effect";
import {
  displayIdSchema,
  filePathSchema,
  projectPathSchema,
  recordingUrlSchema,
  type FilePath,
  type ProjectPath,
} from "../src/schema-primitives";

const acceptsProjectPath = (_value: ProjectPath): void => undefined;

describe("branded schema primitives", () => {
  test("preserves the underlying runtime constraints", () => {
    expect(() => recordingUrlSchema.make("")).toThrow();
    expect(() => displayIdSchema.make(-1)).toThrow();
  });

  test("keeps brands decoded-only while preserving wire encodings", () => {
    const projectPath = Schema.decodeSync(projectPathSchema)("/tmp/project.ggproj");
    expect(projectPath).toBe("/tmp/project.ggproj");
    expect(Schema.encodeSync(projectPathSchema)(projectPath)).toBe("/tmp/project.ggproj");
    expectTypeOf(projectPath).toEqualTypeOf<ProjectPath>();
  });

  test("prevents structurally identical domain values from being mixed", () => {
    const projectPath = projectPathSchema.make("/tmp/project.ggproj");
    const filePath = filePathSchema.make("/tmp/recording.mov");
    acceptsProjectPath(projectPath);
    // @ts-expect-error FilePath and ProjectPath are intentionally nominally distinct.
    acceptsProjectPath(filePath);
    expectTypeOf(filePath).toEqualTypeOf<FilePath>();
  });
});
