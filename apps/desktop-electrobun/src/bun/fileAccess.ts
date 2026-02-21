import { realpathSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isSupportedMediaPath } from "./mediaPolicy";

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
  } catch {
    throw new Error("A valid local file path is required.");
  }

  if (parsedURL.protocol !== "file:") {
    throw new Error("A valid local file path is required.");
  }

  const host = parsedURL.hostname.toLowerCase();
  if (host && host !== "localhost") {
    throw new Error("Only local file URLs are supported.");
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
    throw new Error("Access denied: file path is outside allowed project and temp directories.");
  }
  return canonicalTargetPath;
}

export function resolveAllowedTextFilePath(
  filePath: string,
  options: ReadTextFileOptions = {},
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("A file path is required.");
  }

  const resolvedPath = path.resolve(normalizeLocalFilePathInput(filePath));
  if (path.extname(resolvedPath).toLowerCase() !== ".json") {
    throw new Error("Only .json files can be read through the desktop bridge.");
  }

  return ensurePathWithinAllowedRoots(resolvedPath, options);
}

export function resolveAllowedMediaFilePath(
  filePath: string,
  options: ResolveAllowedMediaFileOptions = {},
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("A file path is required.");
  }

  const resolvedPath = path.resolve(normalizeLocalFilePathInput(filePath));
  if (!isSupportedMediaPath(resolvedPath)) {
    throw new Error("Only video media files can be read through the desktop bridge.");
  }

  const canonicalPath = ensurePathWithinAllowedRoots(resolvedPath, options);
  const projectRoot = projectRootPath(options);
  if (projectRoot && isPathWithinRoot(canonicalPath, projectRoot)) {
    return canonicalPath;
  }

  const tempRoot = tempRootPath(options);
  if (!isPathWithinRoot(canonicalPath, tempRoot)) {
    throw new Error("Access denied: file path is outside allowed project and temp directories.");
  }

  const mediaFileName = path.basename(canonicalPath).toLowerCase();
  if (!mediaFileName.startsWith(mediaTempFilePrefix)) {
    throw new Error(
      "Access denied: temporary media file must use the Guerillaglass temp naming prefix.",
    );
  }

  return canonicalPath;
}

export async function readAllowedTextFile(
  filePath: string,
  options: ReadTextFileOptions = {},
): Promise<string> {
  const resolvedPath = resolveAllowedTextFilePath(filePath, options);
  const fileStat = await stat(resolvedPath);
  if (!fileStat.isFile()) {
    throw new Error("Path must point to a file.");
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_READ_BYTES;
  if (fileStat.size > maxBytes) {
    throw new Error(`File too large to read safely (max ${maxBytes} bytes).`);
  }

  return await readFile(resolvedPath, "utf8");
}
