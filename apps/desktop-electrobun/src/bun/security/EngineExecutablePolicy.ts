import path from "node:path";
import { Effect } from "effect";
import { EngineClientError } from "@guerillaglass/engine/client/errors/clientErrors";
import { AppConfig, type DesktopAppConfig } from "../app/AppConfig";

export function productionLikeEnvironment(config: DesktopAppConfig): boolean {
  return config.nodeEnv === "production" || config.electrobunBuild === "production";
}

function configuredMacosSignatureTrust(config: DesktopAppConfig): boolean {
  return Boolean(config.engineExpectedTeamId?.trim() || config.engineSigningRequirement?.trim());
}

function configuredWindowsAuthenticodeTrust(config: DesktopAppConfig): boolean {
  return Boolean(
    config.windowsExpectedPublisherSha256Thumbprint?.trim() ||
    config.windowsExpectedPublisherSubject?.trim(),
  );
}

function validateStaticConfig(config: DesktopAppConfig): Effect.Effect<void, EngineClientError> {
  return Effect.try({
    try: () => {
      const overridePath = config.enginePath?.trim();
      if (overridePath) {
        if (productionLikeEnvironment(config) && !config.allowCustomEnginePath) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "Custom GG_ENGINE_PATH overrides are disabled in production builds.",
          });
        }

        if (!path.isAbsolute(overridePath)) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "GG_ENGINE_PATH must be an absolute path when provided.",
          });
        }

        if (productionLikeEnvironment(config) && overridePath.endsWith(".ts")) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description: "TypeScript engine stubs are disabled in production builds.",
          });
        }
      }

      const macosHelperPath = config.macosCodeSignatureHelperPath?.trim();
      if (process.platform === "darwin" && configuredMacosSignatureTrust(config)) {
        if (!macosHelperPath || !path.isAbsolute(macosHelperPath)) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description:
              "GG_MACOS_CODE_SIGNATURE_HELPER_PATH must be an absolute path when macOS engine signature trust is configured.",
          });
        }
      }

      const windowsHelperPath = config.windowsAuthenticodeHelperPath?.trim();
      if (process.platform === "win32" && configuredWindowsAuthenticodeTrust(config)) {
        if (!windowsHelperPath || !path.isAbsolute(windowsHelperPath)) {
          throw new EngineClientError({
            code: "ENGINE_PROCESS_UNAVAILABLE",
            description:
              "GG_WINDOWS_AUTHENTICODE_HELPER_PATH must be an absolute path when Windows engine Authenticode trust is configured.",
          });
        }
      }
    },
    catch: (error) => error as EngineClientError,
  });
}

/** Validates development-only native engine executable overrides before the engine layer starts. */
export const validateEngineExecutablePolicy: Effect.Effect<void, EngineClientError, AppConfig> =
  Effect.gen(function* () {
    const config = yield* AppConfig;
    yield* validateStaticConfig(config);
  });
