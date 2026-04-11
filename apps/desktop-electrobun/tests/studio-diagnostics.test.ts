import { describe, expect, test } from "bun:test";
import {
  appendStudioDiagnosticsQuery,
  isStudioDiagnosticsEnabledFromSearch,
} from "../src/shared/studioDiagnostics";

describe("studio diagnostics helpers", () => {
  test("detects the diagnostics query toggle", () => {
    expect(isStudioDiagnosticsEnabledFromSearch("?ggDiagnostics=1")).toBe(true);
    expect(isStudioDiagnosticsEnabledFromSearch("?ggDiagnostics=0")).toBe(false);
    expect(isStudioDiagnosticsEnabledFromSearch("#ggDiagnostics=1")).toBe(true);
    expect(isStudioDiagnosticsEnabledFromSearch("")).toBe(false);
  });

  test("appends the diagnostics query when enabled", () => {
    expect(appendStudioDiagnosticsQuery("http://localhost:5173", true)).toBe(
      "http://localhost:5173?ggDiagnostics=1",
    );
    expect(appendStudioDiagnosticsQuery("views://mainview/index.html", true)).toBe(
      "views://mainview/index.html?ggDiagnostics=1",
    );
    expect(appendStudioDiagnosticsQuery("views://mainview/index.html", false)).toBe(
      "views://mainview/index.html",
    );
  });
});
