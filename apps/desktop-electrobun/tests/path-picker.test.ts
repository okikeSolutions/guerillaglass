import { describe, expect, test } from "bun:test";
import { pickPathForMode } from "../src/bun/path/picker";

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

  test("saveProjectAs uses save dialog when available and enforces extension", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => {
        throw new Error("fallback not expected");
      },
      saveFileDialog: async () => "/Users/demo/Projects/beta",
    });

    expect(result).toBe("/Users/demo/Projects/beta.gglassproj");
  });

  test("saveProjectAs returns null when save dialog is canceled", async () => {
    let fallbackCalls = 0;
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => {
        fallbackCalls += 1;
        return ["/Users/demo/Projects"];
      },
      saveFileDialog: async () => null,
    });

    expect(result).toBeNull();
    expect(fallbackCalls).toBe(0);
  });

  test("saveProjectAs falls back to open picker when save dialog fails", async () => {
    let openDialogCallCount = 0;

    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => {
        openDialogCallCount += 1;
        return ["/Users/demo/Projects"];
      },
      saveFileDialog: async () => {
        throw new Error("save dialog unavailable");
      },
    });

    expect(result).toBe("/Users/demo/Projects/alpha.gglassproj");
    expect(openDialogCallCount).toBe(1);
  });

  test("saveProjectAs fallback keeps explicit .gglassproj file selection", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      defaultFolder: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/beta.gglassproj"],
      saveFileDialog: async () => {
        throw new Error("save dialog unavailable");
      },
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
});
