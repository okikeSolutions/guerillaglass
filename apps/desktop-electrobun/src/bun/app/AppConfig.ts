import { Config, Context, Effect, Layer, Option } from "effect";

export type DesktopAppConfig = {
  readonly captureBenchmarkEnabled: boolean;
  readonly studioDiagnosticsEnabled: boolean;
  readonly mediaServerDebugLoggingEnabled: boolean;
  readonly devServerPort: number;
  readonly nodeEnv: string;
  readonly electrobunBuild: string | null;
  readonly allowCustomEnginePath: boolean;
  readonly enginePath: string | null;
  readonly engineExpectedSha256: string | null;
  readonly engineExpectedTeamId: string | null;
  readonly engineSigningRequirement: string | null;
  readonly macosCodeSignatureHelperPath: string | null;
  readonly windowsAuthenticodeHelperPath: string | null;
  readonly windowsExpectedPublisherSha256Thumbprint: string | null;
  readonly windowsExpectedPublisherSubject: string | null;
  readonly windowsAllowOfflineRevocation: boolean;
  readonly engineRequireCurrentUserOwner: boolean;
  readonly engineRejectWorldWritable: boolean;
  readonly tempDirectory: string | null;
  readonly reviewConvexUrl: string | null;
};

export class AppConfig extends Context.Service<AppConfig, DesktopAppConfig>()(
  "@guerillaglass/desktop/AppConfig",
) {}

const optionalString = (name: string) => Config.option(Config.string(name));

const optionalUrlString = (name: string) =>
  Config.option(Config.url(name)).pipe(Config.map((value) => Option.map(value, String)));

const appConfigEffect = Effect.gen(function* () {
  const ggDebugEnabled = yield* Config.boolean("GG_DEBUG").pipe(Config.withDefault(false));
  const ggReviewConvexUrl = yield* optionalUrlString("GG_REVIEW_CONVEX_URL");
  const viteConvexUrl = yield* optionalUrlString("VITE_CONVEX_URL");

  return AppConfig.of({
    captureBenchmarkEnabled: yield* Config.boolean("GG_CAPTURE_BENCHMARK").pipe(
      Config.withDefault(false),
    ),
    studioDiagnosticsEnabled:
      ggDebugEnabled ||
      (yield* Config.boolean("GG_STUDIO_DIAGNOSTICS").pipe(Config.withDefault(false))),
    mediaServerDebugLoggingEnabled:
      ggDebugEnabled ||
      (yield* Config.boolean("GG_MEDIA_SERVER_DEBUG").pipe(Config.withDefault(false))),
    devServerPort: 5173,
    nodeEnv: yield* Config.string("NODE_ENV").pipe(Config.withDefault("development")),
    electrobunBuild: Option.getOrNull(yield* optionalString("ELECTROBUN_BUILD")),
    allowCustomEnginePath: yield* Config.boolean("GG_ALLOW_CUSTOM_ENGINE_PATH").pipe(
      Config.withDefault(false),
    ),
    enginePath: Option.getOrNull(yield* optionalString("GG_ENGINE_PATH")),
    engineExpectedSha256: Option.getOrNull(yield* optionalString("GG_ENGINE_EXPECTED_SHA256")),
    engineExpectedTeamId: Option.getOrNull(yield* optionalString("GG_ENGINE_EXPECTED_TEAM_ID")),
    engineSigningRequirement: Option.getOrNull(
      yield* optionalString("GG_ENGINE_SIGNING_REQUIREMENT"),
    ),
    macosCodeSignatureHelperPath: Option.getOrNull(
      yield* optionalString("GG_MACOS_CODE_SIGNATURE_HELPER_PATH"),
    ),
    windowsAuthenticodeHelperPath: Option.getOrNull(
      yield* optionalString("GG_WINDOWS_AUTHENTICODE_HELPER_PATH"),
    ),
    windowsExpectedPublisherSha256Thumbprint: Option.getOrNull(
      yield* optionalString("GG_WINDOWS_EXPECTED_PUBLISHER_SHA256_THUMBPRINT"),
    ),
    windowsExpectedPublisherSubject: Option.getOrNull(
      yield* optionalString("GG_WINDOWS_EXPECTED_PUBLISHER_SUBJECT"),
    ),
    windowsAllowOfflineRevocation: yield* Config.boolean(
      "GG_WINDOWS_ALLOW_OFFLINE_REVOCATION",
    ).pipe(Config.withDefault(false)),
    engineRequireCurrentUserOwner: yield* Config.boolean(
      "GG_ENGINE_REQUIRE_CURRENT_USER_OWNER",
    ).pipe(Config.withDefault(false)),
    engineRejectWorldWritable: yield* Config.boolean("GG_ENGINE_REJECT_WORLD_WRITABLE").pipe(
      Config.withDefault(true),
    ),
    tempDirectory: Option.getOrNull(yield* optionalString("TMPDIR")),
    reviewConvexUrl: Option.getOrNull(Option.orElse(ggReviewConvexUrl, () => viteConvexUrl)),
  });
});

export const layerAppConfig = Layer.effect(AppConfig, appConfigEffect);
