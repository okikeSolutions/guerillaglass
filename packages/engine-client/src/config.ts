import { Config, Schema } from "effect";

/**
 * Schema for explicit engine client options supplied by tests or embedding code.
 */
export const engineClientOptionsSchema = Schema.Struct({
  /**
   * Base URL for the engine HTTP API, including scheme and port.
   *
   * @example
   * ```typescript
   * "http://127.0.0.1:49152"
   * ```
   */
  baseUrl: Schema.URL,
  /**
   * Per-process bearer token expected by the native engine.
   */
  bearerToken: Schema.Redacted(Schema.String),
  /**
   * Request timeout in milliseconds.
   *
   * @defaultValue 30000
   */
  requestTimeoutMs: Schema.optionalKey(Schema.Number),
}).annotate({ identifier: "EngineClientOptions" });

/**
 * Explicit options for constructing an engine client without reading from the environment.
 */
export type EngineClientOptions = Schema.Schema.Type<typeof engineClientOptionsSchema>;

/**
 * Effect configuration recipe for loading engine client options from a `ConfigProvider`.
 *
 * @remarks
 * Effect `Config` is used here so URL parsing, secret redaction, defaults, and provider
 * selection are handled by Effect rather than ad hoc process environment reads.
 */
export const EngineClientConfig = Config.all({
  baseUrl: Config.url("ENGINE_BASE_URL"),
  bearerToken: Config.redacted("ENGINE_BEARER_TOKEN"),
  requestTimeoutMs: Config.number("ENGINE_REQUEST_TIMEOUT_MS").pipe(Config.withDefault(30_000)),
});

/**
 * Runtime TypeScript type loaded by {@link EngineClientConfig}.
 */
export type EngineClientConfig = Config.Success<typeof EngineClientConfig>;
