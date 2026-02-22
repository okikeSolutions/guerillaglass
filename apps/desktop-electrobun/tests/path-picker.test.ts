import { describe, expect, test } from "bun:test";
import { pickPathForMode } from "../src/bun/path/picker";

describe("host path picker", () => {
  test("openProject only accepts project package paths", async () => {
    const firstResult = await pickPathForMode("openProject", {
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/not-a-project"],
    });

    const secondResult = await pickPathForMode("openProject", {
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects/alpha.gglassproj"],
    });

    expect(firstResult).toBeNull();
    expect(secondResult).toBe("/Users/demo/Projects/alpha.gglassproj");
  });

  test("saveProjectAs uses save dialog when available and enforces extension", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async () => {
        throw new Error("fallback not expected");
      },
      saveFileDialog: async () => "/Users/demo/Projects/beta",
    });

    expect(result).toBe("/Users/demo/Projects/beta.gglassproj");
  });

  test("saveProjectAs falls back to folder picker when save dialog fails", async () => {
    const result = await pickPathForMode("saveProjectAs", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Projects"],
      saveFileDialog: async () => {
        throw new Error("save dialog unavailable");
      },
    });

    expect(result).toBe("/Users/demo/Projects/alpha.gglassproj");
  });

  test("export mode returns selected directory path", async () => {
    const result = await pickPathForMode("export", {
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async () => ["/Users/demo/Exports"],
    });

    expect(result).toBe("/Users/demo/Exports");
  });

  test("starting folder resolves to parent when current project path is a package", async () => {
    let seenStartingFolder = "";
    await pickPathForMode("openProject", {
      currentProjectPath: "/Users/demo/Projects/alpha.gglassproj",
      documentsPath: "/Users/demo/Documents",
      openFileDialog: async ({ startingFolder }) => {
        seenStartingFolder = startingFolder ?? "";
        return [];
      },
    });

    expect(seenStartingFolder).toBe("/Users/demo/Projects");
  });
});
