import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PACKAGE_EXTENSION = "gglassproj";
const DOCUMENT_TYPE_NAME = "Guerilla Glass Project";
const PROJECT_UTI = "com.okikeSolutions.guerillaglass.project";

type PlistValue = string | number | boolean | null | PlistObject | PlistValue[];
type PlistObject = Record<string, PlistValue>;

const DESIRED_UT_TYPE_DECLARATION: PlistObject = {
  UTTypeIdentifier: PROJECT_UTI,
  UTTypeDescription: DOCUMENT_TYPE_NAME,
  UTTypeConformsTo: ["com.apple.package", "public.data"],
  UTTypeTagSpecification: {
    "public.filename-extension": [PACKAGE_EXTENSION],
  },
};

const DESIRED_DOCUMENT_TYPE_DECLARATION: PlistObject = {
  CFBundleTypeName: DOCUMENT_TYPE_NAME,
  CFBundleTypeRole: "Editor",
  LSHandlerRank: "Owner",
  LSTypeIsPackage: true,
  LSItemContentTypes: [PROJECT_UTI],
  CFBundleTypeExtensions: [PACKAGE_EXTENSION],
};

function isPlistObject(value: PlistValue | undefined): value is PlistObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toObjectArray(value: PlistValue | undefined): PlistObject[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is PlistObject => isPlistObject(item));
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function getStringArray(value: PlistValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function getExtensionTags(entry: PlistObject): string[] {
  if (!isPlistObject(entry.UTTypeTagSpecification)) {
    return [];
  }
  const extensionTag = entry.UTTypeTagSpecification["public.filename-extension"];
  if (typeof extensionTag === "string") {
    return [extensionTag];
  }
  return getStringArray(extensionTag);
}

function isDesiredUTTypeDeclaration(entry: PlistObject): boolean {
  if (entry.UTTypeIdentifier !== PROJECT_UTI) {
    return false;
  }
  if (entry.UTTypeDescription !== DOCUMENT_TYPE_NAME) {
    return false;
  }
  const conformsTo = getStringArray(entry.UTTypeConformsTo);
  if (!arraysEqual(conformsTo, ["com.apple.package", "public.data"])) {
    return false;
  }
  const extensionTags = getExtensionTags(entry);
  return arraysEqual(extensionTags, [PACKAGE_EXTENSION]);
}

function matchesProjectDocumentType(entry: PlistObject): boolean {
  const contentTypes = getStringArray(entry.LSItemContentTypes);
  const extensions = getStringArray(entry.CFBundleTypeExtensions);
  return contentTypes.includes(PROJECT_UTI) || extensions.includes(PACKAGE_EXTENSION);
}

function isDesiredProjectDocumentType(entry: PlistObject): boolean {
  if (!matchesProjectDocumentType(entry)) {
    return false;
  }
  if (entry.CFBundleTypeName !== DOCUMENT_TYPE_NAME) {
    return false;
  }
  if (entry.CFBundleTypeRole !== "Editor") {
    return false;
  }
  if (entry.LSHandlerRank !== "Owner") {
    return false;
  }
  if (entry.LSTypeIsPackage !== true) {
    return false;
  }
  const contentTypes = getStringArray(entry.LSItemContentTypes);
  const extensions = getStringArray(entry.CFBundleTypeExtensions);
  return arraysEqual(contentTypes, [PROJECT_UTI]) && arraysEqual(extensions, [PACKAGE_EXTENSION]);
}

function runPlutil(args: string[]): string {
  const result = spawnSync("plutil", args, { encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim();
    throw new Error(`plutil ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
  }
  return result.stdout;
}

function readInfoPlistAsObject(infoPlistPath: string): PlistObject {
  const output = runPlutil(["-convert", "json", "-o", "-", infoPlistPath]);
  const parsed = JSON.parse(output) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Expected plist root object for ${infoPlistPath}`);
  }
  return parsed as PlistObject;
}

async function writeObjectToInfoPlist(infoPlistPath: string, plist: PlistObject): Promise<void> {
  const normalizedTemporaryDirectory = await mkdtemp(path.join(tmpdir(), "gglassproj-plist-"));
  const jsonPath = path.join(normalizedTemporaryDirectory, "Info.json");
  await writeFile(jsonPath, JSON.stringify(plist, null, 2), "utf8");
  runPlutil(["-convert", "xml1", jsonPath, "-o", infoPlistPath]);
  await rm(normalizedTemporaryDirectory, { recursive: true, force: true });
}

function ensureUTExportedTypeDeclarations(plist: PlistObject): boolean {
  const currentEntries = toObjectArray(plist.UTExportedTypeDeclarations);
  const projectEntries = currentEntries.filter((entry) => entry.UTTypeIdentifier === PROJECT_UTI);

  if (projectEntries.length === 1 && isDesiredUTTypeDeclaration(projectEntries[0])) {
    return false;
  }

  const nextEntries = currentEntries.filter((entry) => {
    const identifier = entry.UTTypeIdentifier;
    return !(typeof identifier === "string" && identifier === PROJECT_UTI);
  });
  nextEntries.push(DESIRED_UT_TYPE_DECLARATION);
  plist.UTExportedTypeDeclarations = nextEntries;
  return true;
}

function ensureDocumentTypes(plist: PlistObject): boolean {
  const currentEntries = toObjectArray(plist.CFBundleDocumentTypes);
  const projectEntries = currentEntries.filter((entry) => matchesProjectDocumentType(entry));

  if (projectEntries.length === 1 && isDesiredProjectDocumentType(projectEntries[0])) {
    return false;
  }

  const nextEntries = currentEntries.filter((entry) => !matchesProjectDocumentType(entry));
  nextEntries.push(DESIRED_DOCUMENT_TYPE_DECLARATION);
  plist.CFBundleDocumentTypes = nextEntries;
  return true;
}

function assertProjectPackageRegistration(plist: PlistObject, infoPlistPath: string): void {
  const utDeclarations = toObjectArray(plist.UTExportedTypeDeclarations);
  const projectType = utDeclarations.find((entry) => entry.UTTypeIdentifier === PROJECT_UTI);
  if (!projectType) {
    throw new Error(`Missing UTExportedTypeDeclarations for ${PROJECT_UTI} in ${infoPlistPath}`);
  }
  const conformance = getStringArray(projectType.UTTypeConformsTo);
  const expectedConformance = ["com.apple.package", "public.data"];
  if (!arraysEqual(conformance, expectedConformance)) {
    throw new Error(
      `UTTypeConformsTo mismatch in ${infoPlistPath}: expected ${expectedConformance.join(", ")} got ${conformance.join(", ")}`,
    );
  }

  const documentTypes = toObjectArray(plist.CFBundleDocumentTypes);
  const projectDocumentType = documentTypes.find((entry) => {
    const contentTypes = getStringArray(entry.LSItemContentTypes);
    return contentTypes.includes(PROJECT_UTI);
  });
  if (!projectDocumentType) {
    throw new Error(
      `Missing CFBundleDocumentTypes declaration for ${PROJECT_UTI} in ${infoPlistPath}`,
    );
  }
  if (projectDocumentType.LSTypeIsPackage !== true) {
    throw new Error(
      `Document type for ${PROJECT_UTI} must set LSTypeIsPackage=true in ${infoPlistPath}`,
    );
  }
}

async function findAppBundles(rootDirectory: string): Promise<string[]> {
  const foundBundles: string[] = [];
  const pendingDirectories: string[] = [rootDirectory];

  while (pendingDirectories.length > 0) {
    const directory = pendingDirectories.pop();
    if (!directory) {
      continue;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }
      if (entry.name.endsWith(".app")) {
        foundBundles.push(entryPath);
        continue;
      }
      pendingDirectories.push(entryPath);
    }
  }

  return foundBundles;
}

async function patchBundleInfoPlist(appBundlePath: string): Promise<void> {
  const infoPlistPath = path.join(appBundlePath, "Contents", "Info.plist");
  const infoStat = await stat(infoPlistPath);
  if (!infoStat.isFile()) {
    return;
  }

  const plist = readInfoPlistAsObject(infoPlistPath);
  const changedDocumentTypes = ensureDocumentTypes(plist);
  const changedUtTypes = ensureUTExportedTypeDeclarations(plist);
  const modified = changedDocumentTypes || changedUtTypes;
  if (modified) {
    await writeObjectToInfoPlist(infoPlistPath, plist);
  }

  const validatedPlist = readInfoPlistAsObject(infoPlistPath);
  assertProjectPackageRegistration(validatedPlist, infoPlistPath);

  const status = modified ? "updated+validated" : "already configured";
  process.stdout.write(`[project-package] ${status}: ${infoPlistPath}\n`);
}

async function main(): Promise<void> {
  if (process.env.ELECTROBUN_OS !== "macos") {
    return;
  }

  const explicitWrapperBundle = process.env.ELECTROBUN_WRAPPER_BUNDLE_PATH;
  if (explicitWrapperBundle) {
    await patchBundleInfoPlist(explicitWrapperBundle);
    return;
  }

  const buildDirectory = process.env.ELECTROBUN_BUILD_DIR;
  if (!buildDirectory) {
    throw new Error("ELECTROBUN_BUILD_DIR is not set");
  }

  const appBundles = await findAppBundles(buildDirectory);
  if (appBundles.length === 0) {
    process.stderr.write(`[project-package] no .app bundles found in ${buildDirectory}\n`);
    return;
  }

  for (const appBundlePath of appBundles) {
    await patchBundleInfoPlist(appBundlePath);
  }
}

await main();
