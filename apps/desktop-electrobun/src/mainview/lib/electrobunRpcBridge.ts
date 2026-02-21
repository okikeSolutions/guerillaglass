import { Electroview } from "electrobun/view";
import { createWindowBridgeBindings } from "../../shared/bridgeBindings";
import type {
  BridgeRequestInvoker,
  DesktopBridgeRPC,
  HostMenuCommand,
  WindowBridgeBindings,
} from "../../shared/bridgeRpc";

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
    handlers: {
      requests: {},
      messages: {
        hostMenuCommand: ({ command }: { command: HostMenuCommand }) => {
          window.dispatchEvent(
            new CustomEvent("gg-host-menu-command", {
              detail: { command },
            }),
          );
        },
      },
    },
  });
  new Electroview({ rpc });

  const invoke: BridgeRequestInvoker = (name, params) => {
    const requestProxy = rpc.request as unknown as Record<
      string,
      (value: unknown) => Promise<unknown>
    >;
    return requestProxy[name](params) as Promise<never>;
  };

  const bindings: WindowBridgeBindings = createWindowBridgeBindings(invoke, (state) =>
    rpc.send.hostMenuState(state),
  );

  Object.assign(window, bindings);
  bridgeInitialized = true;
}
