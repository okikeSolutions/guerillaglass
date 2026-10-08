import { Context, Effect, Layer, Path } from "effect";
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

const normalizeLocalPath = Effect.fn("ProjectExportPathPolicy.normalizeLocalPath")(function (
  path: Path.Path,
  value: string,
): Effect.Effect<string, FileAccessPolicyError> {
  return Effect.gen(function* () {
    const trimmed = value.trim();
    if (!trimmed) {
      return yield* new FileAccessPolicyError({
        code: "FILE_PATH_REQUIRED",
        description: "A file path is required.",
      });
    }
    if (!/^file:\/\//i.test(trimmed)) {
      return path.resolve(trimmed);
    }
    const url = yield* Effect.try({
      try: () => new URL(trimmed),
      catch: (cause) =>
        new FileAccessPolicyError({
          code: "LOCAL_FILE_URL_UNSUPPORTED",
          description: "Only local file URLs are supported.",
          cause,
        }),
    });
    if (url.protocol !== "file:" || (url.hostname && url.hostname.toLowerCase() !== "localhost")) {
      return yield* new FileAccessPolicyError({
        code: "LOCAL_FILE_URL_UNSUPPORTED",
        description: "Only local file URLs are supported.",
      });
    }
    const localPath = yield* path.fromFileUrl(url).pipe(
      Effect.mapError(
        (cause) =>
          new FileAccessPolicyError({
            code: "LOCAL_FILE_URL_UNSUPPORTED",
            description: "Only local file URLs are supported.",
            cause,
          }),
      ),
    );
    return path.resolve(localPath);
  });
});

const requireExtension = Effect.fn("ProjectExportPathPolicy.requireExtension")(function (
  path: Path.Path,
  filePath: string,
  expected: string | ReadonlySet<string>,
): Effect.Effect<string, FileAccessPolicyError> {
  const extension = path.extname(filePath).toLowerCase();
  const allowed = typeof expected === "string" ? extension === expected : expected.has(extension);
  if (!allowed) {
    return Effect.fail(
      new FileAccessPolicyError({
        code: "FILE_ACCESS_OUTSIDE_ALLOWED_ROOTS",
        description: "The selected path is not allowed for this operation.",
      }),
    );
  }
  return Effect.succeed(filePath);
});

const requireGranted = Effect.fn("ProjectExportPathPolicy.requireGranted")(function (
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
});

export const layerProjectExportPathPolicy = Layer.effect(
  ProjectExportPathPolicy,
  Effect.gen(function* () {
    const grants = yield* FileAccessGrants;
    const path = yield* Path.Path;

    const validateProjectPath = (kind: "project-open" | "project-save", projectPath: string) =>
      normalizeLocalPath(path, projectPath).pipe(
        Effect.flatMap((normalizedPath) =>
          requireExtension(path, normalizedPath, projectPackageExtension),
        ),
        Effect.flatMap((normalizedPath) => requireGranted(grants, kind, normalizedPath)),
      );

    return ProjectExportPathPolicy.of({
      validateProjectOpenPath: Effect.fn("ProjectExportPathPolicy.validateProjectOpenPath")(
        (
          projectPath: Parameters<
            (typeof ProjectExportPathPolicy.Service)["validateProjectOpenPath"]
          >[0],
        ) => validateProjectPath("project-open", projectPath),
      ),
      validateProjectSavePath: Effect.fn("ProjectExportPathPolicy.validateProjectSavePath")(
        (
          projectPath: Parameters<
            (typeof ProjectExportPathPolicy.Service)["validateProjectSavePath"]
          >[0],
        ) => validateProjectPath("project-save", projectPath),
      ),
      validateExportOutputPath: Effect.fn("ProjectExportPathPolicy.validateExportOutputPath")(
        (
          outputURL: Parameters<
            (typeof ProjectExportPathPolicy.Service)["validateExportOutputPath"]
          >[0],
        ) =>
          normalizeLocalPath(path, outputURL).pipe(
            Effect.flatMap((normalizedPath) =>
              requireExtension(path, normalizedPath, exportFileExtensions),
            ),
            Effect.flatMap((normalizedPath) =>
              requireGranted(grants, "export-directory", normalizedPath),
            ),
          ),
      ),
    });
  }),
);
