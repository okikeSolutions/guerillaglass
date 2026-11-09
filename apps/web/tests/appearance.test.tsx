// @vitest-environment node
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { themeInitScript } from "../src/lib/appearance";

function ignoreAppearanceEvent(): void {}

function appearance(initialPreference: string | null) {
  let preference = initialPreference;
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  const style = { colorScheme: "" };
  let onChange: () => void = ignoreAppearanceEvent;
  let onStorage: (_event: { key: string | null }) => void = ignoreAppearanceEvent;
  const media = {
    matches: false,
    addEventListener: (_name: string, listener: () => void) => {
      onChange = listener;
    },
  };
  runInNewContext(themeInitScript, {
    window: {
      matchMedia: () => media,
      localStorage: { getItem: () => preference },
      addEventListener: (_name: string, listener: typeof onStorage) => {
        onStorage = listener;
      },
    },
    document: {
      documentElement: {
        classList: {
          remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
          add: (name: string) => classes.add(name),
        },
        setAttribute: (name: string, value: string) => attributes.set(name, value),
        removeAttribute: (name: string) => attributes.delete(name),
        style,
      },
    },
  });
  return {
    classes,
    attributes,
    style,
    changeOS(dark: boolean) {
      media.matches = dark;
      onChange();
    },
    changePreference(value: string | null) {
      preference = value;
      onStorage({ key: "theme" });
    },
  };
}

describe("public appearance initialization", () => {
  it("updates auto mode immediately when the OS changes", () => {
    const app = appearance(null);
    expect(app.classes.has("light")).toBe(true);
    app.changeOS(true);
    expect([...app.classes]).toEqual(["dark"]);
    expect(app.style.colorScheme).toBe("dark");
    expect(app.attributes.has("data-theme")).toBe(false);
  });
  it("preserves explicit preference and responds to persisted preference changes", () => {
    const app = appearance("light");
    app.changeOS(true);
    expect([...app.classes]).toEqual(["light"]);
    app.changePreference("dark");
    expect([...app.classes]).toEqual(["dark"]);
    expect(app.attributes.get("data-theme")).toBe("dark");
    app.changePreference("auto");
    app.changeOS(false);
    expect([...app.classes]).toEqual(["light"]);
    expect(app.attributes.has("data-theme")).toBe(false);
  });
});
