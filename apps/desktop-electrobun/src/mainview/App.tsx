import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { useEffect, useState } from "react";
import {
  hostBridgeEventNames,
  type DesktopRuntimeFlags,
} from "../shared/bridge/desktopBridgeContract";
import { appRouter } from "./app/navigation/router";
import { StudioProvider } from "./app/studio/state/StudioProvider";
import { useStudioController } from "./app/studio/hooks/core/useStudioController";
import { useStudioDiagnosticsSession } from "./lib/studioDiagnostics";
import { CaptureBenchmarkScene } from "./CaptureBenchmarkScene";
import { isCaptureBenchmarkEnabledFromSearch } from "../shared/captureBenchmark";

type RuntimeWindow = Window & {
  __ggDesktopRuntimeFlags?: DesktopRuntimeFlags;
};

function readDesktopRuntimeFlags(): DesktopRuntimeFlags | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as RuntimeWindow).__ggDesktopRuntimeFlags ?? null;
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
  const [desktopRuntimeFlags, setDesktopRuntimeFlags] = useState<DesktopRuntimeFlags | null>(() =>
    readDesktopRuntimeFlags(),
  );

  useEffect(() => {
    const onDesktopRuntimeFlags = (event: Event) => {
      const customEvent = event as CustomEvent<DesktopRuntimeFlags>;
      if (customEvent.detail) {
        setDesktopRuntimeFlags(customEvent.detail);
      }
    };

    window.addEventListener(
      hostBridgeEventNames.desktopRuntimeFlags,
      onDesktopRuntimeFlags as EventListener,
    );
    return () => {
      window.removeEventListener(
        hostBridgeEventNames.desktopRuntimeFlags,
        onDesktopRuntimeFlags as EventListener,
      );
    };
  }, []);

  const captureBenchmarkEnabledFromUrl =
    typeof window !== "undefined" &&
    (isCaptureBenchmarkEnabledFromSearch(window.location.search) ||
      isCaptureBenchmarkEnabledFromSearch(window.location.hash));
  const captureBenchmarkEnabled =
    captureBenchmarkEnabledFromUrl || desktopRuntimeFlags?.captureBenchmarkEnabled === true;

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

  if (captureBenchmarkEnabled) {
    return <CaptureBenchmarkScene />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <StudioAppRouter />
      </HotkeysProvider>
    </QueryClientProvider>
  );
}
