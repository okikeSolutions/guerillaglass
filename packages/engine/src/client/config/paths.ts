import { Effect, FileSystem, Path, PlatformError } from "effect";
import {
  LINUX_NATIVE_BINARY,
  WINDOWS_NATIVE_BINARY,
  type EngineTarget,
} from "@guerillaglass/engine/client/config/targets";

/** Finds the repository root that owns the native engines and package workspaces. */
export function findWorkspaceRoot(
  startDir: string,
): Effect.Effect<string | null, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    let current = path.resolve(startDir);
    while (true) {
      const hasPackage = yield* fs.exists(path.join(current, "Package.swift"));
      const hasDesktopApp = yield* fs.exists(path.join(current, "apps/desktop-electrobun"));
      const hasEngines = yield* fs.exists(path.join(current, "engines"));
      if (hasPackage && hasDesktopApp && hasEngines) {
        return current;
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  });
}

function resolveByTarget(
  path: Path.Path,
  engineTarget: EngineTarget,
  baseDir: string,
  workspaceRoot: string | null,
): string {
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

function firstExisting(
  ...paths: string[]
): Effect.Effect<string, PlatformError.PlatformError, FileSystem.FileSystem> {
  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    for (const candidate of paths) {
      if (yield* fs.exists(candidate)) {
        return candidate;
      }
    }
    return paths[0] ?? "";
  });
}

/** Resolves the engine executable path for the current environment. */
export function resolveEnginePath(options?: {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  baseDir?: string;
}): Effect.Effect<string, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    const env = options?.env ?? process.env;
    const platform = options?.platform ?? process.platform;
    const baseDir = options?.baseDir ?? import.meta.dir;

    if (env.GG_ENGINE_PATH) {
      return env.GG_ENGINE_PATH;
    }

    const workspaceRoot = yield* findWorkspaceRoot(baseDir);
    const engineTarget = (env.GG_ENGINE_TARGET ?? "").trim() as EngineTarget | "";
    if (engineTarget) {
      return resolveByTarget(path, engineTarget, baseDir, workspaceRoot);
    }

    if (platform === "win32") {
      return yield* firstExisting(
        resolveByTarget(path, "windows-native", baseDir, workspaceRoot),
        resolveByTarget(path, "windows-stub", baseDir, workspaceRoot),
      );
    }
    if (platform === "linux") {
      return yield* firstExisting(
        resolveByTarget(path, "linux-native", baseDir, workspaceRoot),
        resolveByTarget(path, "linux-stub", baseDir, workspaceRoot),
      );
    }

    return resolveByTarget(path, "macos-swift", baseDir, workspaceRoot);
  });
}
