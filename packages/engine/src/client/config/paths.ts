import { existsSync } from "node:fs";
import path from "node:path";
import {
  LINUX_NATIVE_BINARY,
  WINDOWS_NATIVE_BINARY,
  type EngineTarget,
} from "@guerillaglass/engine/client/config/targets";

/** Finds the repository root that owns the native engines and package workspaces. */
export function findWorkspaceRoot(startDir: string): string | null {
  let current = path.resolve(startDir);
  while (true) {
    const hasPackage = existsSync(path.join(current, "Package.swift"));
    const hasDesktopApp = existsSync(path.join(current, "apps/desktop-electrobun"));
    const hasEngines = existsSync(path.join(current, "engines"));
    if (hasPackage && hasDesktopApp && hasEngines) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function resolveByTarget(engineTarget: EngineTarget, baseDir: string): string {
  const workspaceRoot = findWorkspaceRoot(baseDir);
  switch (engineTarget) {
    case "macos-swift":
      if (workspaceRoot) {
        return path.join(workspaceRoot, ".build/debug/guerillaglass-engine");
      }
      return path.resolve(baseDir, "../../../../.build/debug/guerillaglass-engine");
    case "windows-native":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/windows-native/bin", WINDOWS_NATIVE_BINARY);
      }
      return path.resolve(baseDir, "../../../../engines/windows-native/bin", WINDOWS_NATIVE_BINARY);
    case "linux-native":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/linux-native/bin", LINUX_NATIVE_BINARY);
      }
      return path.resolve(baseDir, "../../../../engines/linux-native/bin", LINUX_NATIVE_BINARY);
    case "windows-stub":
      if (workspaceRoot) {
        return path.join(
          workspaceRoot,
          "engines/windows-stub/guerillaglass-engine-windows-stub.ts",
        );
      }
      return path.resolve(
        baseDir,
        "../../../../engines/windows-stub/guerillaglass-engine-windows-stub.ts",
      );
    case "linux-stub":
      if (workspaceRoot) {
        return path.join(workspaceRoot, "engines/linux-stub/guerillaglass-engine-linux-stub.ts");
      }
      return path.resolve(
        baseDir,
        "../../../../engines/linux-stub/guerillaglass-engine-linux-stub.ts",
      );
  }
}

function firstExisting(...paths: string[]): string {
  for (const candidate of paths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return paths[0] ?? "";
}

/** Resolves the engine executable path for the current environment. */
export function resolveEnginePath(options?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  baseDir?: string;
}): string {
  const env = options?.env ?? process.env;
  const platform = options?.platform ?? process.platform;
  const baseDir = options?.baseDir ?? import.meta.dir;

  if (env.GG_ENGINE_PATH) {
    return env.GG_ENGINE_PATH;
  }

  const engineTarget = (env.GG_ENGINE_TARGET ?? "").trim() as EngineTarget | "";
  if (engineTarget) {
    return resolveByTarget(engineTarget, baseDir);
  }

  if (platform === "win32") {
    return firstExisting(
      resolveByTarget("windows-native", baseDir),
      resolveByTarget("windows-stub", baseDir),
    );
  }
  if (platform === "linux") {
    return firstExisting(
      resolveByTarget("linux-native", baseDir),
      resolveByTarget("linux-stub", baseDir),
    );
  }

  return resolveByTarget("macos-swift", baseDir);
}
