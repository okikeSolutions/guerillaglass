import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "./paraglide/server.js";

// Official Paraglide boundary: AsyncLocalStorage keeps locale request-scoped.
// No URL strategy is configured, so canonical TanStack routes stay unchanged.
export default createServerEntry({
  fetch(request, options) {
    return paraglideMiddleware(request, ({ request: localizedRequest }) =>
      handler.fetch(localizedRequest, options),
    );
  },
});
