import { Context, Effect } from "effect";
import type { CaptureStatusResult } from "@guerillaglass/engine/protocol/domains/capture";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import type { DesktopAppRuntime } from "../app/AppRuntime";

export type DesktopShellStartOptions = {
  runtime: DesktopAppRuntime;
  onClose: () => Promise<void>;
};

export type DesktopShellService = {
  start: (options: DesktopShellStartOptions) => Effect.Effect<void>;
  publishCaptureStatus: (captureStatus: CaptureStatusResult) => Effect.Effect<void>;
  publishReviewEvent: (event: ReviewBridgeEvent) => Effect.Effect<void>;
  dispose: Effect.Effect<void>;
};

export type DesktopShellLayerOptions = {
  captureBenchmarkEnabled?: boolean;
  studioDiagnosticsEnabled?: boolean;
  devServerPort?: number;
};

/** Effect service that owns Electrobun shell resources and renderer messages. */
export class DesktopShell extends Context.Service<DesktopShell, DesktopShellService>()(
  "@guerillaglass/desktop/DesktopShell",
) {}
