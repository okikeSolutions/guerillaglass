import path from "node:path";
import { Context, Effect, Layer, Ref } from "effect";
import type { HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";

export type FileAccessGrantKind = "project-open" | "project-save" | "export-directory";

type FileAccessGrant = {
  readonly kind: FileAccessGrantKind;
  readonly path: string;
  readonly grantedAt: number;
  readonly expiresAt: number;
};

export type FileAccessGrantsService = {
  readonly grantPickedPath: (mode: HostPathPickerMode, filePath: string) => Effect.Effect<void>;
  readonly grantPath: (kind: FileAccessGrantKind, filePath: string) => Effect.Effect<void>;
  readonly isGrantedPath: (kind: FileAccessGrantKind, filePath: string) => Effect.Effect<boolean>;
};

export class FileAccessGrants extends Context.Service<FileAccessGrants, FileAccessGrantsService>()(
  "@guerillaglass/desktop/FileAccessGrants",
) {}

const grantTtlMs = 30 * 60 * 1000;

function normalizeGrantPath(filePath: string): string {
  return path.resolve(filePath.trim());
}

function isPathWithinRoot(targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function grantPathForKind(kind: FileAccessGrantKind, filePath: string): string {
  const normalizedPath = normalizeGrantPath(filePath);
  return kind === "export-directory" ? normalizedPath : normalizedPath;
}

function grantKindForPickerMode(mode: HostPathPickerMode): FileAccessGrantKind {
  switch (mode) {
    case "openProject":
      return "project-open";
    case "saveProjectAs":
      return "project-save";
    case "export":
      return "export-directory";
  }
}

function grantMatchesPath(grant: FileAccessGrant, kind: FileAccessGrantKind, filePath: string): boolean {
  if (grant.kind !== kind || grant.expiresAt <= Date.now()) return false;
  if (kind === "export-directory") {
    return isPathWithinRoot(filePath, grant.path);
  }
  return filePath === grant.path;
}

export const layerFileAccessGrants = Layer.effect(
  FileAccessGrants,
  Effect.gen(function* () {
    const grantsRef = yield* Ref.make(new Map<string, FileAccessGrant>());

    const grantPath = (kind: FileAccessGrantKind, filePath: string) =>
      Effect.sync(() => normalizeGrantPath(filePath)).pipe(
        Effect.flatMap((normalizedPath) =>
          Ref.update(grantsRef, (grants) => {
            const now = Date.now();
            const next = new Map(
              Array.from(grants.entries()).filter(([, grant]) => grant.expiresAt > now),
            );
            const grantRoot = grantPathForKind(kind, normalizedPath);
            next.set(`${kind}:${grantRoot}`, {
              kind,
              path: grantRoot,
              grantedAt: now,
              expiresAt: now + grantTtlMs,
            });
            return next;
          }),
        ),
      );

    return FileAccessGrants.of({
      grantPickedPath: (mode, filePath) => grantPath(grantKindForPickerMode(mode), filePath),
      grantPath,
      isGrantedPath: (kind, filePath) =>
        Effect.sync(() => normalizeGrantPath(filePath)).pipe(
          Effect.flatMap((normalizedPath) =>
            Ref.get(grantsRef).pipe(
              Effect.map((grants) =>
                Array.from(grants.values()).some((grant) =>
                  grantMatchesPath(grant, kind, normalizedPath),
                ),
              ),
            ),
          ),
        ),
    });
  }),
);
