import type { HostPathPickerMode } from "../../shared/bridgeRpc";

const projectPackageExtension = ".gglassproj";
const defaultProjectName = "guerillaglass-project";

type OpenFileDialogOptions = {
  startingFolder?: string;
  canChooseFiles?: boolean;
  canChooseDirectory?: boolean;
  allowsMultipleSelection?: boolean;
  allowedFileTypes?: string | string[];
};

type SaveFileDialogOptions = {
  startingFolder?: string;
  defaultName?: string;
  allowedFileTypes?: string | string[];
};

type FileDialogDependencies = {
  currentProjectPath?: string | null;
  startingFolder?: string;
  defaultFolder: string;
  openFileDialog: (options: OpenFileDialogOptions) => Promise<string[]>;
  saveFileDialog?: (options: SaveFileDialogOptions) => Promise<string | string[] | null>;
  pathExists?: (filePath: string) => Promise<boolean>;
  confirmOverwritePath?: (filePath: string) => Promise<boolean>;
};

function trimTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function inferPathSeparator(path: string): "/" | "\\" {
  return path.includes("\\") && !path.includes("/") ? "\\" : "/";
}

function getPathBaseName(path: string): string {
  const trimmedPath = trimTrailingSeparators(path);
  const segments = trimmedPath.split(/[\\/]/);
  return segments.at(-1) ?? "";
}

function getParentPath(path: string): string {
  const trimmedPath = trimTrailingSeparators(path);
  const separatorIndex = Math.max(trimmedPath.lastIndexOf("/"), trimmedPath.lastIndexOf("\\"));
  if (separatorIndex <= 0) {
    return trimmedPath;
  }
  return trimmedPath.slice(0, separatorIndex);
}

function stripProjectPackageExtension(name: string): string {
  return name.toLowerCase().endsWith(projectPackageExtension)
    ? name.slice(0, -projectPackageExtension.length)
    : name;
}

function sanitizeProjectName(name: string): string {
  let sanitizedName = "";
  let previousWasDash = false;
  for (const character of name.trim()) {
    const characterCode = character.charCodeAt(0);
    const isWhitespace = /\s/.test(character);
    const isUnsupportedCharacter =
      characterCode <= 31 ||
      character === "<" ||
      character === ">" ||
      character === ":" ||
      character === '"' ||
      character === "/" ||
      character === "\\" ||
      character === "|" ||
      character === "?" ||
      character === "*";

    if (isUnsupportedCharacter || isWhitespace || character === "-") {
      if (!previousWasDash) {
        sanitizedName += "-";
        previousWasDash = true;
      }
      continue;
    }

    sanitizedName += character;
    previousWasDash = false;
  }

  let startIndex = 0;
  let endIndex = sanitizedName.length;
  while (
    startIndex < endIndex &&
    (sanitizedName[startIndex] === "-" ||
      sanitizedName[startIndex] === "." ||
      /\s/.test(sanitizedName[startIndex] ?? ""))
  ) {
    startIndex += 1;
  }
  while (
    endIndex > startIndex &&
    (sanitizedName[endIndex - 1] === "-" ||
      sanitizedName[endIndex - 1] === "." ||
      /\s/.test(sanitizedName[endIndex - 1] ?? ""))
  ) {
    endIndex -= 1;
  }

  return sanitizedName.slice(startIndex, endIndex);
}

function buildProjectPackageName(currentProjectPath?: string | null): string {
  const currentProjectName = currentProjectPath
    ? stripProjectPackageExtension(getPathBaseName(currentProjectPath))
    : "";
  const sanitizedName = sanitizeProjectName(currentProjectName || defaultProjectName);
  const fallbackName = sanitizedName.length > 0 ? sanitizedName : defaultProjectName;
  return `${fallbackName}${projectPackageExtension}`;
}

function resolveStartingFolder(params: {
  startingFolder?: string;
  currentProjectPath?: string | null;
  defaultFolder: string;
}): string {
  const candidate = params.startingFolder ?? params.currentProjectPath ?? params.defaultFolder;
  if (candidate.toLowerCase().endsWith(projectPackageExtension)) {
    return getParentPath(candidate);
  }
  return candidate;
}

function resolveFirstPath(value: string | string[] | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
}

function resolveSaveDialogProjectPath(selectedPath: string): string {
  const trimmedPath = trimTrailingSeparators(selectedPath);
  if (trimmedPath.toLowerCase().endsWith(projectPackageExtension)) {
    return trimmedPath;
  }
  return `${trimmedPath}${projectPackageExtension}`;
}

function joinPath(directoryPath: string, fileName: string): string {
  const trimmedDirectory = trimTrailingSeparators(directoryPath);
  const separator = inferPathSeparator(trimmedDirectory);
  return `${trimmedDirectory}${separator}${fileName}`;
}

function resolveSaveTargetFromOpenSelection(params: {
  selectedPath: string;
  currentProjectPath?: string | null;
}): string {
  const selectedPath = trimTrailingSeparators(params.selectedPath);
  if (selectedPath.toLowerCase().endsWith(projectPackageExtension)) {
    return selectedPath;
  }
  return joinPath(selectedPath, buildProjectPackageName(params.currentProjectPath));
}

async function confirmOverwriteIfNeeded(
  projectPath: string,
  dependencies: Pick<FileDialogDependencies, "pathExists" | "confirmOverwritePath">,
): Promise<boolean> {
  if (!dependencies.pathExists || !dependencies.confirmOverwritePath) {
    return true;
  }
  const exists = await dependencies.pathExists(projectPath);
  if (!exists) {
    return true;
  }
  return await dependencies.confirmOverwritePath(projectPath);
}

/** Opens the host file/save picker for a workflow mode and returns a resolved path target. */
export async function pickPathForMode(
  mode: HostPathPickerMode,
  dependencies: FileDialogDependencies,
): Promise<string | null> {
  const startingFolder = resolveStartingFolder({
    startingFolder: dependencies.startingFolder,
    currentProjectPath: dependencies.currentProjectPath,
    defaultFolder: dependencies.defaultFolder,
  });

  if (mode === "openProject") {
    const selectedPath = resolveFirstPath(
      await dependencies.openFileDialog({
        startingFolder,
        canChooseFiles: true,
        canChooseDirectory: true,
        allowsMultipleSelection: false,
        allowedFileTypes: "gglassproj",
      }),
    );
    if (!selectedPath?.toLowerCase().endsWith(projectPackageExtension)) {
      return null;
    }
    return selectedPath;
  }

  if (mode === "saveProjectAs") {
    let saveTargetPath: string | null = null;

    if (typeof dependencies.saveFileDialog === "function") {
      try {
        const selectedPath = resolveFirstPath(
          await dependencies.saveFileDialog({
            startingFolder,
            defaultName: buildProjectPackageName(dependencies.currentProjectPath),
            allowedFileTypes: "gglassproj",
          }),
        );
        if (selectedPath) {
          saveTargetPath = resolveSaveDialogProjectPath(selectedPath);
        } else {
          return null;
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`saveFileDialog failed, falling back to open picker: ${reason}`);
      }
    }

    if (!saveTargetPath) {
      if (typeof dependencies.saveFileDialog !== "function") {
        console.info(
          "saveFileDialog is unavailable; using open picker fallback for saveProjectAs.",
        );
      }
      const selectedPath = resolveFirstPath(
        await dependencies.openFileDialog({
          startingFolder,
          canChooseFiles: true,
          canChooseDirectory: true,
          allowsMultipleSelection: false,
          allowedFileTypes: "gglassproj",
        }),
      );
      if (!selectedPath) {
        return null;
      }
      saveTargetPath = resolveSaveTargetFromOpenSelection({
        selectedPath,
        currentProjectPath: dependencies.currentProjectPath,
      });
    }

    if (!(await confirmOverwriteIfNeeded(saveTargetPath, dependencies))) {
      return null;
    }

    return saveTargetPath;
  }

  const selectedPath = resolveFirstPath(
    await dependencies.openFileDialog({
      startingFolder,
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
      allowedFileTypes: "*",
    }),
  );

  return selectedPath;
}
