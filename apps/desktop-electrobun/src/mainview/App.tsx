import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { useState } from "react";
import { appRouter } from "./app/router";
import { StudioProvider } from "./app/studio/context";
import { useStudioController } from "./app/studio/useStudioController";

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
      <StudioAppRouter />
    </QueryClientProvider>
  );
}
