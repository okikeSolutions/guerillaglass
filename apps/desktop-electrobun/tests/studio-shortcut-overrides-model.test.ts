import { describe, expect, test } from "bun:test";
import { parseStudioShortcutOverrides } from "@studio/contracts/studioShortcutOverridesModel";

describe("studio shortcut overrides model", () => {
  test("parses valid persisted overrides and drops invalid entries", () => {
    expect(
      parseStudioShortcutOverrides(
        JSON.stringify({
          save: "Control+Shift+P",
          export: "Control+Shift+P",
          record: "???",
        }),
        "windows",
      ),
    ).toEqual({
      save: "Control+Shift+P",
    });
  });

  test("returns empty overrides for malformed storage values", () => {
    expect(parseStudioShortcutOverrides("{not json", "windows")).toEqual({});
    expect(parseStudioShortcutOverrides(JSON.stringify(["bad"]), "windows")).toEqual({});
  });
});
