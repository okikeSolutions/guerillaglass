import { Schema } from "effect";

/**
 * Readiness line emitted on stdout by a v2 HTTP native engine process.
 */
export const engineHttpReadyEnvelopeSchema = Schema.Struct({
  /**
   * Discriminator for HTTP readiness messages.
   */
  type: Schema.Literal("guerillaglass.engine.http.ready"),
  /**
   * Loopback host bound by the native engine.
   */
  host: Schema.String,
  /**
   * TCP port bound by the native engine.
   */
  port: Schema.Int,
}).annotate({ identifier: "EngineHttpReadyEnvelope" });

/**
 * Runtime TypeScript type for v2 HTTP engine readiness messages.
 */
export type EngineHttpReadyEnvelope = Schema.Schema.Type<typeof engineHttpReadyEnvelopeSchema>;

/**
 * Local HTTP address for a ready native engine process.
 */
export type EngineHttpAddress = {
  /**
   * Loopback host bound by the native engine.
   */
  readonly host: string;
  /**
   * TCP port bound by the native engine.
   */
  readonly port: number;
};

/**
 * Returns whether a readiness host is restricted to loopback access.
 *
 * @param host - Host string from a readiness envelope.
 * @returns Whether the host is one of the accepted loopback spellings.
 */
export function isLoopbackReadyHost(host: string): boolean {
  const normalizedHost = host.toLowerCase();
  return (
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "localhost" ||
    normalizedHost === "::1" ||
    normalizedHost === "[::1]"
  );
}

/**
 * Parses and validates a single stdout readiness line from a v2 HTTP engine process.
 *
 * @param line - Raw stdout line.
 * @returns The validated loopback address, or `undefined` when the line is not readiness.
 */
export function parseEngineHttpReadyLine(line: string): EngineHttpAddress | undefined {
  try {
    const value = Schema.decodeUnknownSync(engineHttpReadyEnvelopeSchema)(JSON.parse(line));
    if (!isLoopbackReadyHost(value.host) || value.port <= 0 || value.port > 65_535) {
      return undefined;
    }
    return { host: value.host, port: value.port };
  } catch {
    return undefined;
  }
}

/**
 * Builds the base URL for a ready local engine HTTP server.
 *
 * @param address - Validated engine HTTP address.
 * @returns A URL suitable for `HttpApiClient` `baseUrl`.
 */
export function engineHttpBaseUrl(address: EngineHttpAddress): URL {
  return new URL(`http://${address.host}:${address.port}`);
}
