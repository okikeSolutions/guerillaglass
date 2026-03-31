import { realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileAccessPolicyError } from "../../shared/errors";
import { isSupportedMediaPath } from "../media/policy";

const DEFAULT_MAX_TEXT_READ_BYTES = 5 * 1024 * 1024;
const mediaTempFilePrefix = "guerillaglass-";

type ReadTextFileOptions = {
  currentProjectPath?: string | null;
  maxBytes?: number;
  tempDirectory?: string;
};

type ResolveAllowedMediaFileOptions = Omit<ReadTextFileOptions, "maxBytes">;

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

  return ensurePathWithinAllowedRoots(resolvedPath, options);
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
    return canonicalPath;
  }

  const tempRoot = tempRootPath(options);
  if (!isPathWithinRoot(canonicalPath, tempRoot)) {
    throw new FileAccessPolicyError({
      code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      description: "Access denied: file path is outside allowed project and temp directories.",
    });
  }

  const mediaFileName = path.basename(canonicalPath).toLowerCase();
  if (!mediaFileName.startsWith(mediaTempFilePrefix)) {
    throw new FileAccessPolicyError({
      code: "TEMP_MEDIA_PREFIX_REQUIRED",
      description:
        "Access denied: temporary media file must use the Guerillaglass temp naming prefix.",
    });
  }

  return canonicalPath;
}

/** Reads a validated JSON text file with size and root constraints applied. */
export async function readAllowedTextFile(
  filePath: string,
  options: ReadTextFileOptions = {},
): Promise<string> {
  const resolvedPath = resolveAllowedTextFilePath(filePath, options);
  const fileStat = await stat(resolvedPath);
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

  return await readFile(resolvedPath, "utf8");
}
