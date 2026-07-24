#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

type PackageManifest = {
  version?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
};

const root = resolve(process.env.GG_REPOSITORY_ROOT ?? resolve(import.meta.dir, ".."));
const failures: Array<string> = [];

const requiredGuides = [
  "AGENTS.md",
  "REVIEW.md",
  "docs/CHANGE_MAP.md",
  "apps/desktop-electrobun/AGENTS.md",
  "apps/web/AGENTS.md",
  "packages/engine-contract/AGENTS.md",
  "engines/AGENTS.md",
];

for (const guide of requiredGuides) {
  if (!existsSync(join(root, guide))) {
    failures.push(`missing agent/review guide: ${guide}`);
  }
}

checkEffectVersionAlignment();
checkGeneratedRustDependencyOwnership();
checkLocalizationParity();
checkMarkdownLinks();

if (failures.length > 0) {
  console.error("Repository invariant check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Repository invariant check passed:");
console.log(`- ${requiredGuides.length} required agent/review guides present`);
console.log("- Effect runtime package allowlist matches the vendor version");
console.log("- generated Rust dependency table matches the generator template");
console.log("- localization keys and placeholders match across supported locales");
console.log("- inline local Markdown file links resolve");

function checkEffectVersionAlignment(): void {
  const manifestPaths = [
    "package.json",
    ...workspaceManifestPaths("apps"),
    ...workspaceManifestPaths("packages"),
  ];
  const runtimePackageNames = new Set(["effect", "@effect/platform-bun", "@effect/vitest"]);
  const versions = new Map<string, Array<string>>();

  for (const manifestPath of manifestPaths) {
    const manifest = readJson(join(root, manifestPath));
    for (const dependencyGroup of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ]) {
      if (!dependencyGroup || typeof dependencyGroup !== "object") {
        continue;
      }
      for (const [name, version] of Object.entries(dependencyGroup)) {
        if (!runtimePackageNames.has(name) || typeof version !== "string") {
          continue;
        }
        const locations = versions.get(version) ?? [];
        locations.push(`${manifestPath}:${name}`);
        versions.set(version, locations);
      }
    }
  }

  const vendorManifestPath = "vendor/effect/packages/effect/package.json";
  if (!existsSync(join(root, vendorManifestPath))) {
    failures.push(
      `Effect vendor submodule is unavailable; run git submodule update --init vendor/effect`,
    );
    return;
  }

  const vendorVersion = readJson(join(root, vendorManifestPath)).version;
  if (typeof vendorVersion !== "string") {
    failures.push(`${vendorManifestPath} has no string version`);
    return;
  }

  if (versions.size === 0) {
    failures.push("no Effect runtime dependencies found in workspace manifests");
    return;
  }

  for (const [version, locations] of versions) {
    if (version !== vendorVersion) {
      failures.push(
        `Effect version ${version} at ${locations.join(", ")} does not match vendor/effect ${vendorVersion}`,
      );
    }
  }
}

function checkGeneratedRustDependencyOwnership(): void {
  const generatedPath = "engines/protocol-rust/Cargo.toml";
  const templatePath = "engines/protocol-rust/openapi-generator-templates/Cargo.mustache";
  const generated = readFileSync(join(root, generatedPath), "utf8");
  const template = readFileSync(join(root, templatePath), "utf8");
  const generatedDependencies = tomlSection(generated, "dependencies");
  const templateDependencies = tomlSection(template, "dependencies");

  if (
    generatedDependencies.length === 0 ||
    templateDependencies.length === 0 ||
    generatedDependencies.join("\n") !== templateDependencies.join("\n")
  ) {
    failures.push(
      `${generatedPath} [dependencies] does not match ${templatePath}; edit the template and regenerate bindings`,
    );
  }
}

function checkLocalizationParity(): void {
  const settingsPath = join(root, "project.inlang/settings.json");
  const settings = readUnknownRecord(settingsPath);
  const locales = Array.isArray(settings.locales)
    ? settings.locales.filter((locale): locale is string => typeof locale === "string")
    : [];
  const baseLocale = typeof settings.baseLocale === "string" ? settings.baseLocale : undefined;
  const pathPattern =
    typeof settings["plugin.inlang.messageFormat"] === "object" &&
    settings["plugin.inlang.messageFormat"] !== null &&
    "pathPattern" in settings["plugin.inlang.messageFormat"] &&
    typeof settings["plugin.inlang.messageFormat"].pathPattern === "string"
      ? settings["plugin.inlang.messageFormat"].pathPattern
      : undefined;

  if (!baseLocale || locales.length === 0 || !pathPattern?.includes("{locale}")) {
    failures.push(
      "project.inlang/settings.json must define baseLocale, locales, and a {locale} message path",
    );
    return;
  }

  const orderedLocales = [baseLocale, ...locales.filter((locale) => locale !== baseLocale)];
  const localePaths = orderedLocales.map((locale) =>
    pathPattern.replace("{locale}", locale).replace(/^\.\//, ""),
  );
  const localeMessages = localePaths.map(
    (path) => [path, readStringRecord(join(root, path))] as const,
  );
  const [basePath, baseMessages] = localeMessages[0] ?? ["", {}];
  const baseKeys = Object.keys(baseMessages).sort();

  for (const [localePath, messages] of localeMessages.slice(1)) {
    const keys = Object.keys(messages).sort();
    const missing = baseKeys.filter((key) => !(key in messages));
    const extra = keys.filter((key) => !(key in baseMessages));
    if (missing.length > 0 || extra.length > 0) {
      failures.push(
        `localization key mismatch ${basePath} ↔ ${localePath}; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}`,
      );
    }

    for (const key of baseKeys.filter((candidate) => candidate in messages)) {
      const basePlaceholders = placeholders(baseMessages[key] ?? "");
      const localePlaceholders = placeholders(messages[key] ?? "");
      if (basePlaceholders.join("|") !== localePlaceholders.join("|")) {
        failures.push(
          `localization placeholder mismatch for ${key}: ${basePath} has {${basePlaceholders.join(", ")}}, ${localePath} has {${localePlaceholders.join(", ")}}`,
        );
      }
    }
  }
}

function checkMarkdownLinks(): void {
  const markdownFiles = collectMarkdownFiles(root);
  const linkPattern = /\[[^\]]*\]\(([^)]+)\)/g;

  for (const absolutePath of markdownFiles) {
    const text = readFileSync(absolutePath, "utf8");
    for (const match of text.matchAll(linkPattern)) {
      const rawTarget = match[1]?.trim();
      if (!rawTarget || rawTarget.startsWith("#") || /^(?:https?:|mailto:)/.test(rawTarget)) {
        continue;
      }
      const withoutTitle = rawTarget.split(/\s+["']/)[0] ?? rawTarget;
      const fileTarget = decodeURIComponent(withoutTitle.split("#")[0] ?? "");
      if (!fileTarget) {
        continue;
      }
      const resolvedTarget = resolve(dirname(absolutePath), fileTarget);
      if (!existsSync(resolvedTarget)) {
        failures.push(
          `broken local Markdown link in ${relative(root, absolutePath)}: ${rawTarget}`,
        );
      }
    }
  }
}

function workspaceManifestPaths(directory: string): Array<string> {
  const absoluteDirectory = join(root, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(directory, entry.name, "package.json"))
    .filter((manifestPath) => existsSync(join(root, manifestPath)));
}

function tomlSection(content: string, section: string): Array<string> {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === `[${section}]`);
  if (start < 0) {
    return [];
  }
  const end = lines.findIndex((line, index) => index > start && /^\s*\[/.test(line));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

function placeholders(message: string): Array<string> {
  return [...message.matchAll(/\{([^}]+)\}/g)]
    .map((match) => match[1] ?? "")
    .filter(Boolean)
    .sort();
}

function collectMarkdownFiles(directory: string): Array<string> {
  const ignoredDirectories = new Set([
    ".build",
    ".git",
    ".tmp",
    "node_modules",
    "target",
    "vendor",
  ]);
  const files: Array<string> = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      continue;
    }
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".md") && statSync(entryPath).isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function readJson(path: string): PackageManifest {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
  } catch (error) {
    failures.push(`invalid JSON in ${relative(root, path)}: ${String(error)}`);
    return {};
  }
}

function readStringRecord(path: string): Record<string, string> {
  const parsed = readUnknownRecord(path);
  const nonStringKeys = Object.entries(parsed)
    .filter(([, value]) => typeof value !== "string")
    .map(([key]) => key);
  if (nonStringKeys.length > 0) {
    failures.push(
      `localization messages must be strings in ${relative(root, path)}: ${nonStringKeys.join(", ")}`,
    );
  }
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function readUnknownRecord(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch (error) {
    failures.push(`invalid JSON in ${relative(root, path)}: ${String(error)}`);
    return {};
  }
}
