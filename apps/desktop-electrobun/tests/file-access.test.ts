import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  readAllowedTextFile,
  resolveAllowedMediaFilePath,
  resolveAllowedTextFilePath,
} from "../src/bun/fileAccess";

function createTempDirectory(prefix: string): string {
  return mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe("file access policy", () => {
  test("allows json files in temporary directory", async () => {
    const tempDir = createTempDirectory("gg-file-access-");
    try {
      const filePath = path.join(tempDir, "events.json");
      writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, events: [] }), "utf8");

      const resolvedPath = resolveAllowedTextFilePath(filePath, {
        tempDirectory: os.tmpdir(),
      });
      const contents = await readAllowedTextFile(resolvedPath, {
        tempDirectory: os.tmpdir(),
      });

      expect(resolvedPath).toBe(realpathSync(filePath));
      expect(contents).toContain('"schemaVersion":1');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("allows json files within current project directory", () => {
    const projectDir = createTempDirectory("gg-project-access-");
    try {
      const nestedDir = path.join(projectDir, "Events");
      const filePath = path.join(nestedDir, "recording-events.json");
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(filePath, "{}", "utf8");

      const resolvedPath = resolveAllowedTextFilePath(filePath, {
        currentProjectPath: projectDir,
        tempDirectory: "/var/empty",
      });
      expect(resolvedPath).toBe(realpathSync(filePath));
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("rejects non-json files", () => {
    const tempDir = createTempDirectory("gg-file-access-");
    try {
      const filePath = path.join(tempDir, "notes.txt");
      writeFileSync(filePath, "hello", "utf8");

      expect(() => resolveAllowedTextFilePath(filePath)).toThrow(
        "Only .json files can be read through the desktop bridge.",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects files outside allowed roots", () => {
    const outsidePath = path.resolve(import.meta.dir, "../../../package.json");
    expect(() =>
      resolveAllowedTextFilePath(outsidePath, {
        currentProjectPath: "/definitely/not-this-path",
        tempDirectory: "/var/empty",
      }),
    ).toThrow("Access denied");
  });

  test("rejects oversized files", async () => {
    const tempDir = createTempDirectory("gg-file-access-");
    try {
      const filePath = path.join(tempDir, "large.json");
      writeFileSync(filePath, JSON.stringify({ payload: "x".repeat(1024) }), "utf8");

      await expect(
        readAllowedTextFile(filePath, {
          tempDirectory: os.tmpdir(),
          maxBytes: 16,
        }),
      ).rejects.toThrow("File too large");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("allows media files inside the project directory", () => {
    const projectDir = createTempDirectory("gg-project-media-access-");
    try {
      const assetsDir = path.join(projectDir, "Assets");
      const filePath = path.join(assetsDir, "capture.mp4");
      mkdirSync(assetsDir, { recursive: true });
      writeFileSync(filePath, "video-bytes", "utf8");

      const resolvedPath = resolveAllowedMediaFilePath(filePath, {
        currentProjectPath: projectDir,
        tempDirectory: "/var/empty",
      });
      expect(resolvedPath).toBe(realpathSync(filePath));
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("rejects disallowed media extension for media bridge reads", () => {
    const tempDir = createTempDirectory("gg-file-access-");
    try {
      const filePath = path.join(tempDir, "capture.avi");
      writeFileSync(filePath, "avi-bytes", "utf8");
      expect(() => resolveAllowedMediaFilePath(filePath)).toThrow(
        "Only video media files can be read through the desktop bridge.",
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("rejects media files outside allowed roots", () => {
    const outsideDir = mkdtempSync(path.join(import.meta.dir, "gg-outside-media-"));
    try {
      const outsidePath = path.join(outsideDir, "capture.mov");
      writeFileSync(outsidePath, "video-bytes", "utf8");
      expect(() =>
        resolveAllowedMediaFilePath(outsidePath, {
          currentProjectPath: "/definitely/not-this-path",
          tempDirectory: "/var/empty",
        }),
      ).toThrow("Access denied");
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  test("rejects symlinked media paths that escape allowed roots", () => {
    const projectDir = createTempDirectory("gg-project-media-access-");
    const outsideDir = mkdtempSync(path.join(import.meta.dir, "gg-outside-media-target-"));
    try {
      const outsideMediaPath = path.join(outsideDir, "outside.mov");
      writeFileSync(outsideMediaPath, "video-bytes", "utf8");

      const projectMediaDir = path.join(projectDir, "Assets");
      mkdirSync(projectMediaDir, { recursive: true });
      const symlinkPath = path.join(projectMediaDir, "linked.mov");
      symlinkSync(outsideMediaPath, symlinkPath);

      expect(() =>
        resolveAllowedMediaFilePath(symlinkPath, {
          currentProjectPath: projectDir,
          tempDirectory: "/var/empty",
        }),
      ).toThrow("Access denied");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });
});
