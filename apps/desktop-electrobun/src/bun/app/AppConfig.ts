import { Config, Context, Effect, Layer, Option, Schema } from "effect";

/** Validated runtime settings used by desktop host services. */
export const DesktopAppConfig = Schema.Struct({
  captureBenchmarkEnabled: Schema.Boolean,
  studioDiagnosticsEnabled: Schema.Boolean,
  mediaServerDebugLoggingEnabled: Schema.Boolean,
  devServerPort: Schema.Finite,
  nodeEnv: Schema.String,
  electrobunBuild: Schema.NullOr(Schema.String),
  allowCustomEnginePath: Schema.Boolean,
  enginePath: Schema.NullOr(Schema.String),
  engineExpectedSha256: Schema.NullOr(Schema.String),
  engineExpectedTeamId: Schema.NullOr(Schema.String),
  engineSigningRequirement: Schema.NullOr(Schema.String),
  macosCodeSignatureHelperPath: Schema.NullOr(Schema.String),
  windowsAuthenticodeHelperPath: Schema.NullOr(Schema.String),
  windowsExpectedPublisherSha256Thumbprint: Schema.NullOr(Schema.String),
  windowsExpectedPublisherSubject: Schema.NullOr(Schema.String),
  windowsAllowOfflineRevocation: Schema.Boolean,
  engineRequireCurrentUserOwner: Schema.Boolean,
  engineRejectWorldWritable: Schema.Boolean,
  tempDirectory: Schema.NullOr(Schema.String),
  reviewConvexUrl: Schema.NullOr(Schema.String),
});
export interface DesktopAppConfig extends Schema.Schema.Type<typeof DesktopAppConfig> {}

/** Desktop configuration acquired once when the app layer starts. */
export class AppConfig extends Context.Service<AppConfig, DesktopAppConfig>()(
  "@guerillaglass/desktop/AppConfig",
) {}

const optionalString = (name: string) => Config.option(Config.String(name));

const optionalUrlString = (name: string) =>
  Config.option(Config.URL(name)).pipe(
    Config.map((value) =>
      Option.map(
        Option.filter(value, (url) => url.protocol === "http:" || url.protocol === "https:"),
        String,
      ),
    ),
  );

const readHostedReviewUrl = Effect.fn("AppConfig.readHostedReviewUrl")((name: string) =>
  optionalUrlString(name).pipe(
    Effect.tapError(() =>
      Effect.logWarning("Invalid hosted review URL; local recording remains available", {
        setting: name,
      }),
    ),
    Effect.orElseSucceed(() => Option.none<string>()),
  ),
);

const appConfigEffect = Effect.gen(function* () {
  const ggDebugEnabled = yield* Config.Boolean("GG_DEBUG").pipe(Config.withDefault(false));
  const ggReviewConvexUrl = yield* readHostedReviewUrl("GG_REVIEW_CONVEX_URL");
  const viteConvexUrl = yield* readHostedReviewUrl("VITE_CONVEX_URL");

  return AppConfig.of({
    captureBenchmarkEnabled: yield* Config.Boolean("GG_CAPTURE_BENCHMARK").pipe(
      Config.withDefault(false),
    ),
    studioDiagnosticsEnabled:
      ggDebugEnabled ||
      (yield* Config.Boolean("GG_STUDIO_DIAGNOSTICS").pipe(Config.withDefault(false))),
    mediaServerDebugLoggingEnabled:
      ggDebugEnabled ||
      (yield* Config.Boolean("GG_MEDIA_SERVER_DEBUG").pipe(Config.withDefault(false))),
    devServerPort: 5173,
    nodeEnv: yield* Config.String("NODE_ENV").pipe(Config.withDefault("development")),
    electrobunBuild: Option.getOrNull(yield* optionalString("ELECTROBUN_BUILD")),
    allowCustomEnginePath: yield* Config.Boolean("GG_ALLOW_CUSTOM_ENGINE_PATH").pipe(
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
    windowsAllowOfflineRevocation: yield* Config.Boolean(
      "GG_WINDOWS_ALLOW_OFFLINE_REVOCATION",
    ).pipe(Config.withDefault(false)),
    engineRequireCurrentUserOwner: yield* Config.Boolean(
      "GG_ENGINE_REQUIRE_CURRENT_USER_OWNER",
    ).pipe(Config.withDefault(false)),
    engineRejectWorldWritable: yield* Config.Boolean("GG_ENGINE_REJECT_WORLD_WRITABLE").pipe(
      Config.withDefault(true),
    ),
    tempDirectory: Option.getOrNull(yield* optionalString("TMPDIR")),
    reviewConvexUrl: Option.getOrNull(Option.orElse(ggReviewConvexUrl, () => viteConvexUrl)),
  });
});

/** Reads and validates desktop configuration from the active Config provider. */
export const layerAppConfig = Layer.effect(AppConfig, appConfigEffect);
