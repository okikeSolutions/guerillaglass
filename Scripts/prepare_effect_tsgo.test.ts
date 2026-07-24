import { describe, expect, test } from "bun:test";
import { compilerUsesTsgoVersion } from "./prepare_effect_tsgo";

describe("Effect tsgo prepare wrapper", () => {
  test("skips only the already-installed matching patch", () => {
    expect(compilerUsesTsgoVersion("Version 7.0.2+effect-tsgo.0.24.3", "0.24.3")).toBe(true);
    expect(compilerUsesTsgoVersion("Version 7.0.2", "0.24.3")).toBe(false);
    expect(compilerUsesTsgoVersion("Version 7.0.2+effect-tsgo.0.24.2", "0.24.3")).toBe(false);
  });
});
