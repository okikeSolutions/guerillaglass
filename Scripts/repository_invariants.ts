#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parseSync } from "oxc-parser";

type PackageManifest = {
  version?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  peerDependencies?: Record<string, unknown>;
  optionalDependencies?: Record<string, unknown>;
  scripts?: Record<string, unknown>;
};

const root = resolve(process.env.GG_REPOSITORY_ROOT ?? resolve(import.meta.dir, ".."));
const failures: Array<string> = [];
let effectVendorVersionChecked = false;

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
checkJavaScriptRuntimePolicy();
checkTypeScriptToolingPolicy();
checkEffectPlatformServiceBoundaries();
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
console.log(
  effectVendorVersionChecked
    ? "- Effect runtime packages are aligned and match the initialized vendor submodule"
    : "- Effect runtime packages are aligned (vendor comparison skipped; submodule not initialized)",
);
console.log("- Bun is the only package manager and Effect uses the Node platform adapter");
console.log("- TypeScript 7 uses @effect/tsgo without legacy compiler-API imports");
console.log("- application services use Effect Path, FileSystem, and Crypto boundaries");
console.log("- generated Rust dependency table matches the generator template");
console.log("- localization keys and placeholders match across supported locales");
console.log("- inline local Markdown file links resolve");

function checkEffectVersionAlignment(): void {
  const manifestPaths = [
    "package.json",
    ...workspaceManifestPaths("apps"),
    ...workspaceManifestPaths("packages"),
  ];
  const runtimePackageNames = new Set(["effect", "@effect/platform-node", "@effect/vitest"]);
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

  if (versions.size === 0) {
    failures.push("no Effect runtime dependencies found in workspace manifests");
    return;
  }

  if (versions.size > 1) {
    failures.push(
      `workspace Effect runtime versions are not aligned: ${[...versions.entries()]
        .map(([version, locations]) => `${version} at ${locations.join(", ")}`)
        .join("; ")}`,
    );
    return;
  }

  const workspaceVersion = versions.keys().next().value;
  const vendorManifestPath = "vendor/effect/packages/effect/package.json";
  if (!existsSync(join(root, vendorManifestPath))) {
    return;
  }

  const vendorVersion = readJson(join(root, vendorManifestPath)).version;
  if (typeof vendorVersion !== "string") {
    failures.push(`${vendorManifestPath} has no string version`);
    return;
  }

  effectVendorVersionChecked = true;
  if (workspaceVersion !== vendorVersion) {
    failures.push(
      `workspace Effect runtime version ${workspaceVersion} does not match vendor/effect ${vendorVersion}`,
    );
  }
}

function checkJavaScriptRuntimePolicy(): void {
  for (const forbiddenLockfile of ["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]) {
    if (existsSync(join(root, forbiddenLockfile))) {
      failures.push(`unsupported package-manager lockfile present: ${forbiddenLockfile}`);
    }
  }

  const manifestPaths = [
    "package.json",
    ...workspaceManifestPaths("apps"),
    ...workspaceManifestPaths("packages"),
  ];
  for (const manifestPath of manifestPaths) {
    const manifest = readJson(join(root, manifestPath));
    for (const dependencyGroup of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ]) {
      if (
        dependencyGroup &&
        typeof dependencyGroup === "object" &&
        "@effect/platform-bun" in dependencyGroup
      ) {
        failures.push(
          `${manifestPath} must use @effect/platform-node instead of @effect/platform-bun`,
        );
      }
    }
  }
}

function checkTypeScriptToolingPolicy(): void {
  const manifest = readJson(join(root, "package.json"));
  const typescriptVersion = manifest.devDependencies?.typescript;
  if (typeof typescriptVersion !== "string") {
    failures.push("root devDependencies must pin the TypeScript 7 compiler");
    return;
  }

  const majorVersion = Number.parseInt(typescriptVersion.match(/\d+/)?.[0] ?? "", 10);
  if (majorVersion !== 7) {
    failures.push(
      `root TypeScript compiler must use the supported major 7, found ${typescriptVersion}`,
    );
    return;
  }

  const tsgoVersion = manifest.devDependencies?.["@effect/tsgo"];
  if (typeof tsgoVersion !== "string") {
    failures.push("TypeScript 7 requires @effect/tsgo in root devDependencies");
  }
  const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  if (
    !exactVersionPattern.test(typescriptVersion) ||
    !exactVersionPattern.test(String(tsgoVersion))
  ) {
    failures.push(
      "TypeScript 7 and @effect/tsgo must use exact synchronized versions so lock refreshes cannot create an incompatible compiler pair",
    );
  }

  const manifestPaths = [
    "package.json",
    ...workspaceManifestPaths("apps"),
    ...workspaceManifestPaths("packages"),
  ];
  for (const manifestPath of manifestPaths) {
    const workspaceManifest = readJson(join(root, manifestPath));
    for (const dependencyGroup of [
      workspaceManifest.dependencies,
      workspaceManifest.devDependencies,
      workspaceManifest.peerDependencies,
      workspaceManifest.optionalDependencies,
    ]) {
      if (!dependencyGroup) {
        continue;
      }
      if ("@effect/language-service" in dependencyGroup) {
        failures.push(
          `${manifestPath} must use @effect/tsgo instead of @effect/language-service with TypeScript 7`,
        );
      }
      const workspaceTypeScriptVersion = dependencyGroup.typescript;
      if (
        typeof workspaceTypeScriptVersion === "string" &&
        workspaceTypeScriptVersion !== typescriptVersion
      ) {
        failures.push(
          `${manifestPath} TypeScript version ${workspaceTypeScriptVersion} does not match root ${typescriptVersion}`,
        );
      }
    }
  }

  if (manifest.scripts?.prepare !== "bun ./Scripts/prepare_effect_tsgo.ts") {
    failures.push(
      'TypeScript 7 requires the root prepare script "bun ./Scripts/prepare_effect_tsgo.ts"',
    );
  }

  const scriptsRoot = join(root, "Scripts");
  if (!existsSync(scriptsRoot)) {
    return;
  }
  for (const sourcePath of collectSourceFiles(scriptsRoot)) {
    const source = readFileSync(sourcePath, "utf8");
    const { program, errors } = parseSync(sourcePath, source);
    if (errors.length > 0) {
      failures.push(
        `${relative(root, sourcePath)} could not be parsed while checking tooling imports`,
      );
      continue;
    }
    if (astLoadsTypeScriptCompilerApi(program)) {
      failures.push(
        `${relative(root, sourcePath)} imports the removed TypeScript 7 compiler API; use a dedicated parser`,
      );
    }
  }
}

function isTypeScriptCompilerSpecifier(value: unknown): boolean {
  return typeof value === "string" && (value === "typescript" || value.startsWith("typescript/"));
}

function staticModuleSpecifier(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const expression = value as Record<string, unknown>;
  if (expression.type === "Literal") {
    return expression.value;
  }
  if (
    expression.type === "TemplateLiteral" &&
    (expression.expressions as Array<unknown> | undefined)?.length === 0
  ) {
    const firstQuasi = (expression.quasis as Array<Record<string, unknown>> | undefined)?.[0];
    return (firstQuasi?.value as { cooked?: unknown } | undefined)?.cooked;
  }
  return undefined;
}

function astLoadsTypeScriptCompilerApi(rootNode: object): boolean {
  const pending: Array<unknown> = [rootNode];
  const seen = new WeakSet<object>();

  while (pending.length > 0) {
    const value = pending.pop();
    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }
    seen.add(value);
    const node = value as Record<string, unknown>;

    if (
      (node.type === "ImportDeclaration" ||
        node.type === "ExportNamedDeclaration" ||
        node.type === "ExportAllDeclaration") &&
      isTypeScriptCompilerSpecifier(staticModuleSpecifier(node.source))
    ) {
      return true;
    }
    if (
      node.type === "ImportExpression" &&
      isTypeScriptCompilerSpecifier(staticModuleSpecifier(node.source))
    ) {
      return true;
    }
    if (
      node.type === "CallExpression" &&
      (node.callee as { type?: unknown; name?: unknown } | null)?.type === "Identifier" &&
      (node.callee as { name?: unknown }).name === "require" &&
      isTypeScriptCompilerSpecifier(
        staticModuleSpecifier((node.arguments as Array<unknown> | undefined)?.[0]),
      )
    ) {
      return true;
    }
    if (
      node.type === "TSExternalModuleReference" &&
      isTypeScriptCompilerSpecifier(staticModuleSpecifier(node.expression))
    ) {
      return true;
    }

    pending.push(...Object.values(node));
  }

  return false;
}

function checkEffectPlatformServiceBoundaries(): void {
  const allowedNodePlatformAdapters = new Set([
    "apps/desktop-electrobun/src/bun/security/fileAccess.ts",
  ]);
  const forbiddenImport =
    /(?:from\s+|import\s*(?:\(\s*)?|require\s*\(\s*)(["'`])node:(?:path|fs(?:\/promises)?|crypto)\1/g;

  const applicationSourceRoots = ["apps", "packages"].flatMap((workspaceRoot) => {
    const absoluteWorkspaceRoot = join(root, workspaceRoot);
    if (!existsSync(absoluteWorkspaceRoot)) {
      return [];
    }
    return readdirSync(absoluteWorkspaceRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(absoluteWorkspaceRoot, entry.name, "src"))
      .filter(existsSync);
  });

  for (const absoluteSourceRoot of applicationSourceRoots) {
    for (const sourcePath of collectSourceFiles(absoluteSourceRoot)) {
      const repositoryPath = relative(root, sourcePath);
      if (allowedNodePlatformAdapters.has(repositoryPath)) {
        continue;
      }
      const source = readFileSync(sourcePath, "utf8");
      if (forbiddenImport.test(source)) {
        failures.push(
          `${repositoryPath} must use Effect Path, FileSystem, or Crypto services instead of direct Node platform imports`,
        );
      }
      forbiddenImport.lastIndex = 0;
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

function collectSourceFiles(directory: string): Array<string> {
  const files: Array<string> = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "paraglide") {
      continue;
    }
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(entryPath));
    } else if (entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
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
