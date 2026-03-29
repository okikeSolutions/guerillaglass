import { Electroview } from "electrobun/view";
import type { CaptureStatusResult } from "@guerillaglass/engine-protocol";
import type { ReviewBridgeEvent } from "@guerillaglass/review-protocol";
import { createWindowBridgeBindings } from "@shared/bridge";
import type {
  BridgeRequestName,
  BridgeRequestInvoker,
  BridgeRequests,
  BridgeResponseEnvelope,
  DesktopBridgeRPC,
  HostMenuCommand,
  WindowBridgeBindings,
} from "@shared/bridge";
import { hostBridgeEventNames } from "@shared/bridge";

type ElectrobunRuntimeWindow = Window & {
  __electrobun?: unknown;
};

let bridgeInitialized = false;

export function initializeElectrobunRpcBridge(): void {
  if (bridgeInitialized) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  if (!(window as ElectrobunRuntimeWindow).__electrobun) {
    return;
  }

  const rpc = Electroview.defineRPC<DesktopBridgeRPC>({
    maxRequestTime: Infinity,
    handlers: {
      requests: {},
      messages: {
        hostMenuCommand: ({ command }: { command: HostMenuCommand }) => {
          window.dispatchEvent(
            new CustomEvent(hostBridgeEventNames.menuCommand, {
              detail: { command },
            }),
          );
        },
        hostCaptureStatus: ({ captureStatus }: { captureStatus: CaptureStatusResult }) => {
          window.dispatchEvent(
            new CustomEvent(hostBridgeEventNames.captureStatus, {
              detail: { captureStatus },
            }),
          );
        },
        hostReviewEvent: ({ event }: { event: ReviewBridgeEvent }) => {
          window.dispatchEvent(
            new CustomEvent(hostBridgeEventNames.reviewEvent, {
              detail: { event },
            }),
          );
        },
      },
    },
  });
  new Electroview({ rpc });

  const invoke: BridgeRequestInvoker = <K extends BridgeRequestName>(
    name: K,
    params: BridgeRequests[K]["params"],
  ) => {
    const requestProxy = rpc.request as unknown as Record<
      string,
      (value: unknown) => Promise<unknown>
    >;
    return requestProxy[name](params) as Promise<
      BridgeResponseEnvelope<BridgeRequests[K]["response"]>
    >;
  };

  const bindings: WindowBridgeBindings = createWindowBridgeBindings(invoke, (state) =>
    rpc.send.hostMenuState(state),
  );

  Object.assign(window, bindings);
  bridgeInitialized = true;
}
