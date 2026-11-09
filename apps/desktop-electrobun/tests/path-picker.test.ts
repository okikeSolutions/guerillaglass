import { Effect } from "effect";
import { describe, expect, test } from "vitest";
import { pickPathForMode, pickPathForModeEffect } from "../src/bun/path/picker";
import { PathPickerError } from "@shared/errors/desktopErrors";

describe("host path picker", () => {
  test("openProject only accepts project package paths", async () => {
    const firstResult = await pickPathForMode("openProject", {
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/not-a-project"],
    });

    const secondResult = await pickPathForMode("openProject", {
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/alpha.gglassproj"],
    });

    expect(firstResult).toBeNull();
    expect(secondResult).toBe("/Users/demo/Projects/alpha.gglassproj");
  });

  test("saveProjectAs uses open picker and enforces extension", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/beta"],
    });

    expect(result).toBe("/Users/demo/Projects/beta/alpha.gglassproj");
  });

  test("saveProjectAs keeps explicit .gglassproj file selection", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/beta.gglassproj"],
    });

    expect(result).toBe("/Users/demo/Projects/beta.gglassproj");
  });

  test("saveProjectAs returns null when fallback open picker is canceled", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: null,
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => [],
    });

    expect(result).toBeNull();
  });

  test("saveProjectAs asks for overwrite confirmation when target exists", async () => {
    let confirmedPath = "";
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: null,
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Documents/existing.gglassproj"],
      pathExists: async () => true,
      confirmOverwritePath: async (filePath) => {
        confirmedPath = filePath;
        return false;
      },
    });

    expect(confirmedPath).toBe("/Users/demo/Documents/existing.gglassproj");
    expect(result).toBeNull();
  });

  test("saveProjectAs skips overwrite confirmation when target does not exist", async () => {
    let confirmCalls = 0;
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: null,
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Documents/new-project.gglassproj"],
      pathExists: async () => false,
      confirmOverwritePath: async () => {
        confirmCalls += 1;
        return false;
      },
    });

    expect(result).toBe("/Users/demo/Documents/new-project.gglassproj");
    expect(confirmCalls).toBe(0);
  });

  test("export mode returns selected directory path", async () => {
    const result = await pickPathForMode("export", {
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Exports"],
    });

    expect(result).toBe("/Users/demo/Exports");
  });

  test("starting folder resolves to parent when current project path is a package", async () => {
    let seenStartingFolder = "";
    await pickPathForMode("openProject", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async ({ startingFolder }) => {
        seenStartingFolder = startingFolder ?? "";
        return [];
      },
    });

    expect(seenStartingFolder).toBe("/Users/demo/Projects");
  });

  test("openProject surfaces tagged picker failures", async () => {
    try {
      await pickPathForMode("openProject", {
        defaultFolder: "/Users/demo/Documents",
        openFileDialog: async () => {
          throw new Error("open dialog unavailable");
        },
      });
      throw new Error("Expected open dialog failure");
    } catch (error) {
      expect(error).toBeInstanceOf(PathPickerError);
      if (!(error instanceof PathPickerError)) {
        throw error;
      }
      expect(error.code).toBe("PATH_PICKER_OPEN_DIALOG_FAILED");
      expect(error.message).toBe("open dialog unavailable");
    }
  });
});

describe("native Save As target selection", () => {
  test("accepts a new filename, adds the project extension and never opens the fallback picker", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/projects/old.gglassproj",
      defaultFolder: "/projects",
      openFileDialog: async () => {
        throw new Error("Fallback picker must not open");
      },
      saveFileDialog: async (options) => {
        expect(options.defaultName).toBe("old.gglassproj");
        expect(options.startingFolder).toBe("/projects");
        return '/projects/new $name "demo"';
      },
    });
    expect(result).toBe('/projects/new $name "demo".gglassproj');
  });

  test("cancelling the Save panel grants no target and does not confirm overwrite", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      defaultFolder: "/projects",
      openFileDialog: async () => [],
      saveFileDialog: async () => null,
      pathExists: async () => {
        throw new Error("No selection to inspect");
      },
    });
    expect(result).toBeNull();
  });

  test("extension completion still checks overwrite authority", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      defaultFolder: "/projects",
      openFileDialog: async () => [],
      saveFileDialog: async () => "/projects/existing",
      pathExists: async (path) => {
        expect(path).toBe("/projects/existing.gglassproj");
        return true;
      },
      confirmOverwritePath: async () => false,
    });
    expect(result).toBeNull();
  });
});

describe("native export folder chooser", () => {
  test("export chooses only a directory and cancellation returns no target", async () => {
    let folder = "";
    const result = await pickPathForMode("export", {
      currentProjectPath: "/projects/demo.gglassproj",
      defaultFolder: "/exports",
      openFileDialog: async () => {
        throw new Error("Export must use the native folder chooser");
      },
      folderDialog: async (options) => {
        folder = options.startingFolder;
        return null;
      },
    });
    expect(folder).toBe("/projects");
    expect(result).toBeNull();
  });

  test("Effect export preserves the selected directory for existing picker grants", async () => {
    const result = await Effect.runPromise(
      pickPathForModeEffect("export", {
        defaultFolder: "/exports",
        openFileDialog: () => Effect.die("Export must use the native folder chooser"),
        folderDialog: (options) => {
          expect(options.startingFolder).toBe("/exports");
          return Effect.succeed('/exports/Project "demo"/');
        },
      }),
    );
    expect(result).toBe('/exports/Project "demo"/');
  });
});
