import { describe, expect, test } from "bun:test";
import {
  studioBadgeToneClass,
  studioButtonToneClass,
  studioIconToneClass,
  studioToggleToneClass,
  studioToneClass,
} from "../src/mainview/app/studio/model/studioSemanticTone";

describe("studio semantic tones", () => {
  test("maps semantic states to stable token classes", () => {
    expect(studioToneClass("neutral")).toBe("gg-tone-neutral");
    expect(studioToneClass("record")).toBe("gg-tone-danger");
    expect(studioToneClass("error")).toBe("gg-tone-danger");
    expect(studioToneClass("live")).toBe("gg-tone-success");
    expect(studioToneClass("selected")).toBe("gg-tone-selected");
    expect(studioToneClass("selectedAlt")).toBe("gg-tone-selected-alt");
  });

  test("builds icon/button/badge/toggle class strings", () => {
    expect(studioIconToneClass("record")).toContain("gg-icon-tone");
    expect(studioIconToneClass("record")).toContain("gg-tone-danger");

    expect(studioButtonToneClass("live")).toContain("gg-button-tone");
    expect(studioButtonToneClass("live")).toContain("gg-tone-success");

    expect(studioBadgeToneClass("selected")).toContain("gg-badge-tone");
    expect(studioBadgeToneClass("selected")).toContain("gg-tone-selected");

    expect(studioToggleToneClass("selectedAlt")).toContain("gg-toggle-tone");
    expect(studioToggleToneClass("selectedAlt")).toContain("gg-tone-selected-alt");
  });
});
