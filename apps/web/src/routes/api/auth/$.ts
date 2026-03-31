import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => handler(request),
      POST: ({ request }: { request: Request }) => handler(request),
    },
  },
});
