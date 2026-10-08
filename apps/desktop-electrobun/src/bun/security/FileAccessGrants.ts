import { Clock, Context, Effect, Layer, Path, Ref, Schema } from "effect";
import type { HostPathPickerMode } from "../../shared/bridge/desktopBridgeContract";

/** Filesystem authority conferred by a successful host picker action. */
export const FileAccessGrantKind = Schema.Literals([
  "project-open",
  "project-save",
  "export-directory",
]);
export type FileAccessGrantKind = typeof FileAccessGrantKind.Type;

const FileAccessGrant = Schema.Struct({
  kind: FileAccessGrantKind,
  path: Schema.String,
  grantedAt: Schema.Finite,
  expiresAt: Schema.Finite,
});
interface FileAccessGrant extends Schema.Schema.Type<typeof FileAccessGrant> {}

export type FileAccessGrantsService = {
  readonly grantPickedPath: (mode: HostPathPickerMode, filePath: string) => Effect.Effect<void>;
  readonly grantPath: (kind: FileAccessGrantKind, filePath: string) => Effect.Effect<void>;
  readonly isGrantedPath: (kind: FileAccessGrantKind, filePath: string) => Effect.Effect<boolean>;
};

export class FileAccessGrants extends Context.Service<FileAccessGrants, FileAccessGrantsService>()(
  "@guerillaglass/desktop/FileAccessGrants",
) {}

const grantTtlMs = 30 * 60 * 1000;

function normalizeGrantPath(path: Path.Path, filePath: string): string {
  return path.resolve(filePath.trim());
}

function isPathWithinRoot(path: Path.Path, targetPath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

function grantMatchesPath(
  path: Path.Path,
  grant: FileAccessGrant,
  kind: FileAccessGrantKind,
  filePath: string,
  now: number,
): boolean {
  if (grant.kind !== kind || grant.expiresAt <= now) {
    return false;
  }
  if (kind === "export-directory") {
    return isPathWithinRoot(path, filePath, grant.path);
  }
  return filePath === grant.path;
}

export const layerFileAccessGrants = Layer.effect(
  FileAccessGrants,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    const grantsRef = yield* Ref.make(new Map<string, FileAccessGrant>());

    // Grants are authoritative picker permissions. A missing entry must never be populated
    // by a cache lookup, and export-directory grants authorize descendants of their root.
    const grantPath = Effect.fn("FileAccessGrants.grantPath")(function* (
      kind: FileAccessGrantKind,
      filePath: string,
    ) {
      const normalizedPath = normalizeGrantPath(path, filePath);
      const now = yield* Clock.currentTimeMillis;
      yield* Ref.update(grantsRef, (grants) => {
        const next = new Map(
          Array.from(grants.entries()).filter(([, grant]) => grant.expiresAt > now),
        );
        next.set(`${kind}:${normalizedPath}`, {
          kind,
          path: normalizedPath,
          grantedAt: now,
          expiresAt: now + grantTtlMs,
        });
        return next;
      });
    });

    return FileAccessGrants.of({
      grantPickedPath: Effect.fn("FileAccessGrants.grantPickedPath")(
        (mode: HostPathPickerMode, filePath: string) =>
          grantPath(grantKindForPickerMode(mode), filePath),
      ),
      grantPath,
      isGrantedPath: Effect.fn("FileAccessGrants.isGrantedPath")(function* (
        kind: FileAccessGrantKind,
        filePath: string,
      ) {
        const normalizedPath = normalizeGrantPath(path, filePath);
        const now = yield* Clock.currentTimeMillis;
        const grants = yield* Ref.get(grantsRef);
        return Array.from(grants.values()).some((grant) =>
          grantMatchesPath(path, grant, kind, normalizedPath, now),
        );
      }),
    });
  }),
);
