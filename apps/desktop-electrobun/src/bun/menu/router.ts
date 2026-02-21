import type { HostMenuCommand } from "../../shared/bridgeRpc";
import { decodeHostMenuAction } from "./actions";

type MenuActionHandlers = {
  dispatchHostCommand: (command: HostMenuCommand) => void;
  toggleDevTools: () => void;
  openDocs: () => void;
  quit: () => void;
};

/** Routes desktop menu actions to host command and shell handlers. */
export function routeMenuAction(action: string, handlers: MenuActionHandlers): void {
  const command = decodeHostMenuAction(action);
  if (command) {
    handlers.dispatchHostCommand(command);
    return;
  }

  if (action === "view.toggleDevTools") {
    handlers.toggleDevTools();
    return;
  }
  if (action === "help.docs") {
    handlers.openDocs();
    return;
  }
  if (action === "app.quit") {
    handlers.quit();
  }
}
