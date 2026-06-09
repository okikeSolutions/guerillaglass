import path from "node:path";
import { fileURLToPath } from "node:url";
import { Context, Effect, Layer } from "effect";
import { FileAccessPolicyError } from "../../shared/errors/desktopErrors";
import type { FileAccessGrantsService } from "./FileAccessGrants";
import { FileAccessGrants } from "./FileAccessGrants";

const projectPackageExtension = ".gglassproj";
const exportFileExtensions = new Set([".mp4", ".mov"]);

type ProjectExportPathPolicyService = {
  readonly validateProjectOpenPath: (
    projectPath: string,
  ) => Effect.Effect<string, FileAccessPolicyError>;
  readonly validateProjectSavePath: (
    projectPath: string,
  ) => Effect.Effect<string, FileAccessPolicyError>;
  readonly validateExportOutputPath: (
    outputURL: string,
  ) => Effect.Effect<string, FileAccessPolicyError>;
};

export class ProjectExportPathPolicy extends Context.Service<
  ProjectExportPathPolicy,
  ProjectExportPathPolicyService
>()("@guerillaglass/desktop/ProjectExportPathPolicy") {}

function normalizeLocalPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FileAccessPolicyError({
      code: "FILE_PATH_REQUIRED",
      description: "A file path is required.",
    });
  }
  if (!/^file:\/\//i.test(trimmed)) {
    return path.resolve(trimmed);
  }
  const url = new URL(trimmed);
  if (url.protocol !== "file:" || (url.hostname && url.hostname.toLowerCase() !== "localhost")) {
    throw new FileAccessPolicyError({
      code: "LOCAL_FILE_URL_UNSUPPORTED",
      description: "Only local file URLs are supported.",
    });
  }
  return path.resolve(fileURLToPath(url));
}

function requireExtension(filePath: string, expected: string | ReadonlySet<string>): string {
  const extension = path.extname(filePath).toLowerCase();
  const allowed = typeof expected === "string" ? extension === expected : expected.has(extension);
  if (!allowed) {
    throw new FileAccessPolicyError({
      code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
      description: "The selected path is not allowed for this operation.",
    });
  }
  return filePath;
}

function requireGranted(
  grants: FileAccessGrantsService,
  kind: "project-open" | "project-save" | "export-directory",
  filePath: string,
): Effect.Effect<string, FileAccessPolicyError> {
  return grants.isGrantedPath(kind, filePath).pipe(
    Effect.flatMap((isGranted) => {
      if (isGranted) {
        return Effect.succeed(filePath);
      }
      return Effect.fail(
        new FileAccessPolicyError({
          code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
          description: "Access denied: path was not selected through a trusted desktop picker.",
        }),
      );
    }),
  );
}

export const layerProjectExportPathPolicy = Layer.effect(
  ProjectExportPathPolicy,
  Effect.gen(function* () {
    const grants = yield* FileAccessGrants;

    const validateProjectPath = (kind: "project-open" | "project-save", projectPath: string) =>
      Effect.sync(() =>
        requireExtension(normalizeLocalPath(projectPath), projectPackageExtension),
      ).pipe(Effect.flatMap((normalizedPath) => requireGranted(grants, kind, normalizedPath)));

    return ProjectExportPathPolicy.of({
      validateProjectOpenPath: (projectPath) => validateProjectPath("project-open", projectPath),
      validateProjectSavePath: (projectPath) => validateProjectPath("project-save", projectPath),
      validateExportOutputPath: (outputURL) =>
        Effect.sync(() =>
          requireExtension(normalizeLocalPath(outputURL), exportFileExtensions),
        ).pipe(
          Effect.flatMap((normalizedPath) =>
            requireGranted(grants, "export-directory", normalizedPath),
          ),
        ),
    });
  }),
);
