import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { useState } from "react";
import { appRouter } from "./app/navigation/router";
import { StudioProvider } from "./app/studio/state/StudioProvider";
import { useStudioController } from "./app/studio/hooks/core/useStudioController";

function StudioAppRouter() {
  const studio = useStudioController();
  return (
    <StudioProvider value={studio}>
      <RouterProvider router={appRouter} />
    </StudioProvider>
  );
}

export default function App() {
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
