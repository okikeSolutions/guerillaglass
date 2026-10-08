import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe } from "vitest";
import { NoFollowFileIO, layerNoFollowFileIO } from "../src/bun/security/NoFollowFileIO";
import {
  readAllowedTextFile as readAllowedTextFileEffect,
  resolveAllowedMediaFilePath as resolveAllowedMediaFilePathEffect,
  resolveAllowedTextFilePath as resolveAllowedTextFilePathEffect,
} from "../src/bun/security/fileAccess";

const platformLayer = Layer.mergeAll(NodeServices.layer, layerNoFollowFileIO);
const readAllowedTextFile = (...args: Parameters<typeof readAllowedTextFileEffect>) =>
  readAllowedTextFileEffect(...args).pipe(Effect.provide(platformLayer));
const resolveAllowedMediaFilePath = (
  ...args: Parameters<typeof resolveAllowedMediaFilePathEffect>
) => resolveAllowedMediaFilePathEffect(...args).pipe(Effect.provide(platformLayer));
const resolveAllowedTextFilePath = (...args: Parameters<typeof resolveAllowedTextFilePathEffect>) =>
  resolveAllowedTextFilePathEffect(...args).pipe(Effect.provide(platformLayer));

const testDirectory = fileURLToPath(new URL(".", import.meta.url));

function acquireTempDirectory(prefix: string) {
  return Effect.acquireRelease(
    Effect.sync(() => mkdtempSync(path.join(os.tmpdir(), prefix))),
    (directory) => Effect.sync(() => rmSync(directory, { recursive: true, force: true })),
  );
}

function withTempDirectory(
  prefix: string,
  use: (directory: string) => Effect.Effect<void, unknown>,
) {
  return Effect.scoped(
    Effect.gen(function* () {
      const directory = yield* acquireTempDirectory(prefix);
      yield* use(directory);
    }),
  );
}

function expectPolicyCode(error: unknown, code: string): void {
  expect(error).toMatchObject({ code });
}

describe("file access policy", () => {
  it.live("reads JSON under the temporary directory and preserves its data", () =>
    withTempDirectory("gg-file-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "events.json");
        yield* Effect.sync(() =>
          writeFileSync(filePath, JSON.stringify({ schemaVersion: 1, events: [] }), "utf8"),
        );

        const resolvedPath = yield* resolveAllowedTextFilePath(filePath, {
          tempDirectory: os.tmpdir(),
        });
        const contents = yield* readAllowedTextFile(resolvedPath, {
          tempDirectory: os.tmpdir(),
        });
        expect(resolvedPath).toBe(path.resolve(filePath));
        expect(JSON.parse(contents)).toEqual({ schemaVersion: 1, events: [] });
      }),
    ),
  );

  it.live("allows JSON nested inside the current project directory", () =>
    withTempDirectory("gg-project-access-", (projectDir) =>
      Effect.gen(function* () {
        const nestedDir = path.join(projectDir, "Events");
        const filePath = path.join(nestedDir, "recording-events.json");
        yield* Effect.sync(() => {
          mkdirSync(nestedDir, { recursive: true });
          writeFileSync(filePath, "{}", "utf8");
        });

        const resolvedPath = yield* resolveAllowedTextFilePath(filePath, {
          currentProjectPath: projectDir,
          tempDirectory: "/var/empty",
        });
        expect(resolvedPath).toBe(path.resolve(filePath));
      }),
    ),
  );

  it.live("rejects non-JSON bridge reads", () =>
    withTempDirectory("gg-file-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "notes.txt");
        yield* Effect.sync(() => writeFileSync(filePath, "hello", "utf8"));
        const error = yield* Effect.flip(resolveAllowedTextFilePath(filePath));
        expectPolicyCode(error, "TEXT_FILE_TYPE_UNSUPPORTED");
      }),
    ),
  );

  it.live("rejects text paths outside every granted root", () =>
    Effect.gen(function* () {
      const outsidePath = path.resolve(testDirectory, "../../../package.json");
      const error = yield* Effect.flip(
        resolveAllowedTextFilePath(outsidePath, {
          currentProjectPath: "/definitely/not-this-path",
          tempDirectory: "/var/empty",
        }),
      );
      expectPolicyCode(error, "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
    }),
  );

  it.live("rejects text files larger than the caller's byte limit", () =>
    withTempDirectory("gg-file-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "large.json");
        yield* Effect.sync(() =>
          writeFileSync(filePath, JSON.stringify({ payload: "x".repeat(1024) }), "utf8"),
        );
        const error = yield* Effect.flip(
          readAllowedTextFile(filePath, { tempDirectory: os.tmpdir(), maxBytes: 16 }),
        );
        expectPolicyCode(error, "FILE_TOO_LARGE");
      }),
    ),
  );

  it.live("allows media files inside the current project directory", () =>
    withTempDirectory("gg-project-media-access-", (projectDir) =>
      Effect.gen(function* () {
        const assetsDir = path.join(projectDir, "Assets");
        const filePath = path.join(assetsDir, "capture.mp4");
        yield* Effect.sync(() => {
          mkdirSync(assetsDir, { recursive: true });
          writeFileSync(filePath, "video-bytes", "utf8");
        });
        const resolvedPath = yield* resolveAllowedMediaFilePath(filePath, {
          currentProjectPath: projectDir,
          tempDirectory: "/var/empty",
        });
        expect(resolvedPath).toBe(path.resolve(filePath));
      }),
    ),
  );

  it.live("allows prefixed media files under the temporary directory", () =>
    withTempDirectory("gg-media-temp-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "guerillaglass-recording-session.mov");
        yield* Effect.sync(() => writeFileSync(filePath, "video-bytes", "utf8"));
        const resolvedPath = yield* resolveAllowedMediaFilePath(filePath, {
          tempDirectory: os.tmpdir(),
        });
        expect(resolvedPath).toBe(path.resolve(filePath));
      }),
    ),
  );

  it.live("accepts local file URLs for supported media", () =>
    withTempDirectory("gg-media-temp-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "guerillaglass-recording-session.mov");
        yield* Effect.sync(() => writeFileSync(filePath, "video-bytes", "utf8"));
        const resolvedPath = yield* resolveAllowedMediaFilePath(pathToFileURL(filePath).href, {
          tempDirectory: os.tmpdir(),
        });
        expect(resolvedPath).toBe(path.resolve(filePath));
      }),
    ),
  );

  it.live("rejects remote file URL hosts", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveAllowedMediaFilePath("file://example.com/tmp/guerillaglass-recording.mov"),
      );
      expectPolicyCode(error, "LOCAL_FILE_URL_UNSUPPORTED");
    }),
  );

  it.live("rejects temporary media without the app-owned filename prefix", () =>
    withTempDirectory("gg-media-temp-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "capture.mov");
        yield* Effect.sync(() => writeFileSync(filePath, "video-bytes", "utf8"));
        const error = yield* Effect.flip(
          resolveAllowedMediaFilePath(filePath, { tempDirectory: os.tmpdir() }),
        );
        expectPolicyCode(error, "TEMP_MEDIA_PREFIX_REQUIRED");
      }),
    ),
  );

  it.live("rejects media extensions the desktop bridge does not serve", () =>
    withTempDirectory("gg-file-access-", (tempDir) =>
      Effect.gen(function* () {
        const filePath = path.join(tempDir, "capture.avi");
        yield* Effect.sync(() => writeFileSync(filePath, "avi-bytes", "utf8"));
        const error = yield* Effect.flip(resolveAllowedMediaFilePath(filePath));
        expectPolicyCode(error, "MEDIA_FILE_TYPE_UNSUPPORTED");
      }),
    ),
  );

  it.live("rejects media files outside every granted root", () =>
    withTempDirectory("gg-outside-media-", (outsideDir) =>
      Effect.gen(function* () {
        const outsidePath = path.join(outsideDir, "capture.mov");
        yield* Effect.sync(() => writeFileSync(outsidePath, "video-bytes", "utf8"));
        const error = yield* Effect.flip(
          resolveAllowedMediaFilePath(outsidePath, {
            currentProjectPath: "/definitely/not-this-path",
            tempDirectory: "/var/empty",
          }),
        );
        expectPolicyCode(error, "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
      }),
    ),
  );

  it.live("rejects symlinked media that escapes the project directory", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const projectDir = yield* acquireTempDirectory("gg-project-media-access-");
        const outsideDir = yield* acquireTempDirectory("gg-outside-media-target-");
        const outsideMediaPath = path.join(outsideDir, "outside.mov");
        const projectMediaDir = path.join(projectDir, "Assets");
        const symlinkPath = path.join(projectMediaDir, "linked.mov");
        yield* Effect.sync(() => {
          writeFileSync(outsideMediaPath, "video-bytes", "utf8");
          mkdirSync(projectMediaDir, { recursive: true });
          symlinkSync(outsideMediaPath, symlinkPath);
        });
        const error = yield* Effect.flip(
          resolveAllowedMediaFilePath(symlinkPath, {
            currentProjectPath: projectDir,
            tempDirectory: "/var/empty",
          }),
        );
        expectPolicyCode(error, "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS");
      }),
    ),
  );

  it.live("rejects final-component symlinks for reads and immutable snapshots", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const directory = yield* acquireTempDirectory("gg-no-follow-file-access-");
        const targetPath = path.join(directory, "target.mov");
        const symlinkPath = path.join(directory, "linked.mov");
        const snapshotPath = path.join(directory, "snapshot.mov");
        yield* Effect.sync(() => {
          writeFileSync(targetPath, "private-media", "utf8");
          symlinkSync(targetPath, symlinkPath);
        });

        const fileIO = yield* NoFollowFileIO;
        const readError = yield* Effect.flip(fileIO.readText(symlinkPath, 1024));
        const snapshotError = yield* Effect.flip(
          fileIO.copySnapshot(symlinkPath, snapshotPath, 1024),
        );

        expect(readError).toMatchObject({ code: "PATH_NOT_FILE" });
        expect(snapshotError).toMatchObject({ code: "PATH_NOT_FILE" });
      }),
    ).pipe(Effect.provide(layerNoFollowFileIO)),
  );
});
