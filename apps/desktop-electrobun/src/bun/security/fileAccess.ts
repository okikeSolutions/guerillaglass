import { constants, realpathSync } from "node:fs";
import { lstat, mkdir, open } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileAccessPolicyError } from "../../shared/errors/desktopErrors";
import { isSupportedMediaPath } from "../media/policy";

const DEFAULT_MAX_TEXT_READ_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_MEDIA_SNAPSHOT_BYTES = 20 * 1024 * 1024 * 1024;
const mediaTempFilePrefix = "guerillaglass-";

type ReadTextFileOptions = {
  currentProjectPath?: string | null;
  maxBytes?: number;
  tempDirectory?: string;
};

type ResolveAllowedMediaFileOptions = Omit<ReadTextFileOptions, "maxBytes">;

type CopySafeFileSnapshotOptions = {
  maxBytes?: number;
};

function tempRootPath(options: ResolveAllowedMediaFileOptions): string {
  return canonicalizePath(options.tempDirectory ?? os.tmpdir());
}

function projectRootPath(options: ResolveAllowedMediaFileOptions): string | null {
  const projectPath = options.currentProjectPath?.trim();
  if (!projectPath) {
    return null;
  }
  return canonicalizePath(path.resolve(projectPath));
}

function canonicalizePath(candidatePath: string): string {
  try {
    return realpathSync(candidatePath);
  } catch {
    return path.resolve(candidatePath);
  }
}

function normalizeLocalFilePathInput(filePath: string): string {
  const trimmedPath = filePath.trim();
  if (!/^file:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  let parsedURL: URL;
  try {
    parsedURL = new URL(trimmedPath);
  } catch (error) {
    throw new FileAccessPolicyError({
      code: "LOCAL_FILE_PATH_INVALID",
      description: "A valid local file path is required.",
      cause: error,
    });
  }

  if (parsedURL.protocol !== "file:") {
    throw new FileAccessPolicyError({
      code: "LOCAL_FILE_PATH_INVALID",
      description: "A valid local file path is required.",
    });
  }

  const host = parsedURL.hostname.toLowerCase();
  if (host && host !== "localhost") {
    throw new FileAccessPolicyError({
      code: "LOCAL_FILE_URL_UNSUPPORTED",
      description: "Only local file URLs are supported.",
    });
  }

  return fileURLToPath(parsedURL);
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function allowedRoots(options: ResolveAllowedMediaFileOptions): string[] {
  const roots = new Set<string>([tempRootPath(options)]);
  const projectRoot = projectRootPath(options);
  if (projectRoot) {
    roots.add(projectRoot);
  }
  return Array.from(roots);
}

function ensurePathWithinAllowedRoots(
  resolvedPath: string,
  options: ResolveAllowedMediaFileOptions = {},
): string {
  const roots = allowedRoots(options);
  const canonicalTargetPath = canonicalizePath(resolvedPath);
  const isAllowed = roots.some((rootPath) => isPathWithinRoot(canonicalTargetPath, rootPath));
  if (!isAllowed) {
    throw new FileAccessPolicyError({
      code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      description: "Access denied: file path is outside allowed project and temp directories.",
    });
  }
  return canonicalTargetPath;
}

/** Resolves and validates a JSON text file path for bridge reads. */
export function resolveAllowedTextFilePath(
  filePath: string,
  options: ReadTextFileOptions = {},
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new FileAccessPolicyError({
      code: "FILE_PATH_REQUIRED",
      description: "A file path is required.",
    });
  }

  const resolvedPath = path.resolve(normalizeLocalFilePathInput(filePath));
  if (path.extname(resolvedPath).toLowerCase() !== ".json") {
    throw new FileAccessPolicyError({
      code: "TEXT_FILE_TYPE_UNSUPPORTED",
      description: "Only .json files can be read through the desktop bridge.",
    });
  }

  ensurePathWithinAllowedRoots(resolvedPath, options);
  return resolvedPath;
}

/** Resolves and validates a supported media file path for bridge reads. */
export function resolveAllowedMediaFilePath(
  filePath: string,
  options: ResolveAllowedMediaFileOptions = {},
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new FileAccessPolicyError({
      code: "FILE_PATH_REQUIRED",
      description: "A file path is required.",
    });
  }

  const resolvedPath = path.resolve(normalizeLocalFilePathInput(filePath));
  if (!isSupportedMediaPath(resolvedPath)) {
    throw new FileAccessPolicyError({
      code: "MEDIA_FILE_TYPE_UNSUPPORTED",
      description: "Only video media files can be read through the desktop bridge.",
    });
  }

  const canonicalPath = ensurePathWithinAllowedRoots(resolvedPath, options);
  const projectRoot = projectRootPath(options);
  if (projectRoot && isPathWithinRoot(canonicalPath, projectRoot)) {
    return resolvedPath;
  }

  const tempRoot = tempRootPath(options);
  if (!isPathWithinRoot(canonicalPath, tempRoot)) {
    throw new FileAccessPolicyError({
      code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      description: "Access denied: file path is outside allowed project and temp directories.",
    });
  }

  const mediaFileName = path.basename(resolvedPath).toLowerCase();
  if (!mediaFileName.startsWith(mediaTempFilePrefix)) {
    throw new FileAccessPolicyError({
      code: "TEMP_MEDIA_PREFIX_REQUIRED",
      description:
        "Access denied: temporary media file must use the Guerillaglass temp naming prefix.",
    });
  }

  return resolvedPath;
}

async function rejectFinalSymlink(filePath: string): Promise<void> {
  const fileStat = await lstat(filePath);
  if (fileStat.isSymbolicLink()) {
    throw new FileAccessPolicyError({
      code: "PATH_NOT_FILE",
      description: "Path must point to a regular file, not a symbolic link.",
    });
  }
}

async function openNoFollowRead(filePath: string) {
  await rejectFinalSymlink(filePath);
  const noFollow = (constants as typeof constants & { O_NOFOLLOW?: number }).O_NOFOLLOW ?? 0;
  return await open(filePath, constants.O_RDONLY | noFollow);
}

/** Copies a file through no-follow handles to create an app-owned immutable serving snapshot. */
export async function copySafeFileSnapshot(
  sourcePath: string,
  destinationPath: string,
  options: CopySafeFileSnapshotOptions = {},
): Promise<string> {
  await mkdir(path.dirname(destinationPath), { recursive: true, mode: 0o700 });
  const sourceHandle = await openNoFollowRead(sourcePath);
  const destinationHandle = await open(
    destinationPath,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    0o600,
  );
  try {
    const fileStat = await sourceHandle.stat();
    if (!fileStat.isFile()) {
      throw new FileAccessPolicyError({
        code: "PATH_NOT_FILE",
        description: "Path must point to a file.",
      });
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_MEDIA_SNAPSHOT_BYTES;
    if (fileStat.size > maxBytes) {
      throw new FileAccessPolicyError({
        code: "FILE_TOO_LARGE",
        description: `File too large to snapshot safely (max ${maxBytes} bytes).`,
      });
    }

    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let copiedBytes = 0;
    while (true) {
      const { bytesRead } = await sourceHandle.read(buffer, 0, buffer.byteLength, null);
      if (bytesRead === 0) break;
      copiedBytes += bytesRead;
      if (copiedBytes > maxBytes) {
        throw new FileAccessPolicyError({
          code: "FILE_TOO_LARGE",
          description: `File too large to snapshot safely (max ${maxBytes} bytes).`,
        });
      }
      await destinationHandle.write(buffer, 0, bytesRead);
    }
    return destinationPath;
  } finally {
    await Promise.allSettled([sourceHandle.close(), destinationHandle.close()]);
  }
}

/** Reads a validated JSON text file with size and root constraints applied. */
export async function readAllowedTextFile(
  filePath: string,
  options: ReadTextFileOptions = {},
): Promise<string> {
  const resolvedPath = resolveAllowedTextFilePath(filePath, options);
  const handle = await openNoFollowRead(resolvedPath);
  try {
    const fileStat = await handle.stat();
    if (!fileStat.isFile()) {
      throw new FileAccessPolicyError({
        code: "PATH_NOT_FILE",
        description: "Path must point to a file.",
      });
    }

    const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_READ_BYTES;
    if (fileStat.size > maxBytes) {
      throw new FileAccessPolicyError({
        code: "FILE_TOO_LARGE",
        description: `File too large to read safely (max ${maxBytes} bytes).`,
      });
    }

    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}
