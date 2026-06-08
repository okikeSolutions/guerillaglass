import { Effect } from "effect";
import type { SerializedBridgeError } from "../../shared/errors/desktopErrors";
import { AppConfig, type DesktopAppConfig } from "../app/AppConfig";

function productionLikeEnvironment(config: DesktopAppConfig): boolean {
  return config.nodeEnv === "production" || config.electrobunBuild === "production";
}

const sensitiveDataKeys = new Set(["stack", "authToken", "token", "password", "secret"]);

function redactData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    next[key] = sensitiveDataKeys.has(key) ? "<redacted>" : value;
  }
  return next;
}

/** Removes sensitive diagnostics from bridge errors before transport to renderer code. */
export function redactBridgeErrorForRenderer(
  error: SerializedBridgeError,
  config: DesktopAppConfig,
): SerializedBridgeError {
  if (!productionLikeEnvironment(config)) {
    return error;
  }

  const redacted: SerializedBridgeError = {
    tag: error.tag,
    message: error.tag === "UnknownError" ? "An unexpected desktop error occurred." : error.message,
    data: redactData(error.data),
  };
  if (error.cause) {
    redacted.cause = redactBridgeErrorForRenderer(error.cause, config);
  }
  return redacted;
}

export function redactBridgeErrorForRendererEffect(
  error: SerializedBridgeError,
): Effect.Effect<SerializedBridgeError, never, AppConfig> {
  return Effect.map(AppConfig, (config) => redactBridgeErrorForRenderer(error, config));
}
