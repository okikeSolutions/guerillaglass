import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { useEffect, useState } from "react";
import { hostBridgeEventNames, type HostRuntimeFlags } from "../shared/bridge";
import { appRouter } from "./app/navigation/router";
import { StudioProvider } from "./app/studio/state/StudioProvider";
import { useStudioController } from "./app/studio/hooks/core/useStudioController";
import { useStudioDiagnosticsSession } from "./lib/studioDiagnostics";
import { CaptureBenchmarkScene } from "./CaptureBenchmarkScene";
import { isCaptureBenchmarkEnabledFromSearch } from "../shared/captureBenchmark";

type RuntimeWindow = Window & {
  __ggHostRuntimeFlags?: HostRuntimeFlags;
};

function readHostRuntimeFlags(): HostRuntimeFlags | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as RuntimeWindow).__ggHostRuntimeFlags ?? null;
}

function StudioAppRouter() {
  const studio = useStudioController();
  useStudioDiagnosticsSession();
  return (
    <StudioProvider value={studio}>
      <RouterProvider router={appRouter} />
    </StudioProvider>
  );
}

export default function App() {
  const [hostRuntimeFlags, setHostRuntimeFlags] = useState<HostRuntimeFlags | null>(() =>
    readHostRuntimeFlags(),
  );

  useEffect(() => {
    const onRuntimeFlags = (event: Event) => {
      const customEvent = event as CustomEvent<HostRuntimeFlags>;
      if (customEvent.detail) {
        setHostRuntimeFlags(customEvent.detail);
      }
    };

    window.addEventListener(hostBridgeEventNames.runtimeFlags, onRuntimeFlags as EventListener);
    return () => {
      window.removeEventListener(
        hostBridgeEventNames.runtimeFlags,
        onRuntimeFlags as EventListener,
      );
    };
  }, []);

  const captureBenchmarkEnabledFromUrl =
    typeof window !== "undefined" &&
    (isCaptureBenchmarkEnabledFromSearch(window.location.search) ||
      isCaptureBenchmarkEnabledFromSearch(window.location.hash));
  const captureBenchmarkEnabled =
    captureBenchmarkEnabledFromUrl || hostRuntimeFlags?.captureBenchmarkEnabled === true;

  if (captureBenchmarkEnabled) {
    return <CaptureBenchmarkScene />;
  }

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <StudioAppRouter />
      </HotkeysProvider>
    </QueryClientProvider>
  );
}
