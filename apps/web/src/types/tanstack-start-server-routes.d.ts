type ServerRouteRequest = {
  request: Request;
};

type ServerRouteHandler = (context: ServerRouteRequest) => Response | Promise<Response>;

declare module "@tanstack/router-core" {
  interface UpdatableRouteOptionsExtensions {
    server?: {
      handlers: Partial<Record<string, ServerRouteHandler>>;
    };
  }
}
