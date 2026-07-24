import { Effect, Path } from "effect";
import { EngineProcessError } from "@guerillaglass/engine-client/errors";
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

function validateStaticConfig(
  path: Path.Path,
  config: DesktopAppConfig,
): Effect.Effect<void, EngineProcessError> {
  return Effect.try({
    try: () => {
      const overridePath = config.enginePath?.trim();
      if (overridePath) {
        if (productionLikeEnvironment(config) && !config.allowCustomEnginePath) {
          throw new EngineProcessError({
            code: "ENGINE_PATH_UNAVAILABLE",
            message: "Custom GG_ENGINE_PATH overrides are disabled in production builds.",
          });
        }

        if (!path.isAbsolute(overridePath)) {
          throw new EngineProcessError({
            code: "ENGINE_PATH_UNAVAILABLE",
            message: "GG_ENGINE_PATH must be an absolute path when provided.",
          });
        }

        if (productionLikeEnvironment(config) && overridePath.endsWith(".ts")) {
          throw new EngineProcessError({
            code: "ENGINE_PATH_UNAVAILABLE",
            message: "TypeScript engine executables are disabled in production builds.",
          });
        }
      }

      const macosHelperPath = config.macosCodeSignatureHelperPath?.trim();
      if (process.platform === "darwin" && configuredMacosSignatureTrust(config)) {
        if (!macosHelperPath || !path.isAbsolute(macosHelperPath)) {
          throw new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message:
              "GG_MACOS_CODE_SIGNATURE_HELPER_PATH must be an absolute path when macOS engine signature trust is configured.",
          });
        }
      }

      const windowsHelperPath = config.windowsAuthenticodeHelperPath?.trim();
      if (process.platform === "win32" && configuredWindowsAuthenticodeTrust(config)) {
        if (!windowsHelperPath || !path.isAbsolute(windowsHelperPath)) {
          throw new EngineProcessError({
            code: "ENGINE_TRUST_REJECTED",
            message:
              "GG_WINDOWS_AUTHENTICODE_HELPER_PATH must be an absolute path when Windows engine Authenticode trust is configured.",
          });
        }
      }
    },
    catch: (error) => error as EngineProcessError,
  });
}

/** Validates development-only native engine executable overrides before the engine layer starts. */
export const validateEngineExecutablePolicy: Effect.Effect<
  void,
  EngineProcessError,
  AppConfig | Path.Path
> = Effect.gen(function* () {
  const config = yield* AppConfig;
  const path = yield* Path.Path;
  yield* validateStaticConfig(path, config);
});
