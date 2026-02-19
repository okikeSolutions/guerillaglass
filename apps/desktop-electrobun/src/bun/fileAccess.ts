import { realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_MAX_TEXT_READ_BYTES = 5 * 1024 * 1024;

type ReadTextFileOptions = {
  currentProjectPath?: string | null;
  maxBytes?: number;
  tempDirectory?: string;
};

function canonicalizePath(candidatePath: string): string {
  try {
    return realpathSync(candidatePath);
  } catch {
    return path.resolve(candidatePath);
  }
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveAllowedTextFilePath(
  filePath: string,
  options: ReadTextFileOptions = {},
): string {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("A file path is required.");
  }

  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== ".json") {
    throw new Error("Only .json files can be read through the desktop bridge.");
  }

  const projectPath = options.currentProjectPath?.trim();
  const roots = new Set<string>([
    canonicalizePath(options.tempDirectory ?? os.tmpdir()),
    canonicalizePath("/tmp"),
  ]);
  if (projectPath) {
    roots.add(canonicalizePath(path.resolve(projectPath)));
  }

  const canonicalTargetPath = canonicalizePath(resolvedPath);
  const isAllowed = Array.from(roots).some((rootPath) =>
    isPathWithinRoot(canonicalTargetPath, rootPath),
  );
  if (!isAllowed) {
    throw new Error("Access denied: file path is outside allowed project and temp directories.");
  }

  return canonicalTargetPath;
}

export async function readAllowedTextFile(
  filePath: string,
  options: ReadTextFileOptions = {},
): Promise<string> {
  const resolvedPath = resolveAllowedTextFilePath(filePath, options);
  const fileStat = statSync(resolvedPath);
  if (!fileStat.isFile()) {
    throw new Error("Path must point to a file.");
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_READ_BYTES;
  if (fileStat.size > maxBytes) {
    throw new Error(`File too large to read safely (max ${maxBytes} bytes).`);
  }

  return await readFile(resolvedPath, "utf8");
}
