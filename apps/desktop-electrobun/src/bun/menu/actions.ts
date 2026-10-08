import {
  hostMenuCommandList,
  type HostMenuCommand,
} from "../../shared/bridge/desktopBridgeContract";

const hostCommandPrefix = "host:";
const hostMenuCommandSet = new Set<string>(hostMenuCommandList);

/** Narrows a string to a supported host menu command. */
export function isHostMenuCommand(value: string): value is HostMenuCommand {
  return hostMenuCommandSet.has(value);
}

/** Encodes a host menu command into the menu action payload format. */
export function encodeHostMenuAction(command: HostMenuCommand): string {
  return `${hostCommandPrefix}${command}`;
}

/** Decodes a menu action payload into a host command when possible. */
export function decodeHostMenuAction(action: string): HostMenuCommand | null {
  if (!action.startsWith(hostCommandPrefix)) {
    return null;
  }
  const command = action.slice(hostCommandPrefix.length);
  return isHostMenuCommand(command) ? command : null;
}

/** Extracts the action string from an Electrobun menu event payload. */
export function extractMenuAction(event: unknown): string | null {
  if (typeof event !== "object" || event === null || !("data" in event)) {
    return null;
  }
  const eventData = event.data;
  if (typeof eventData !== "object" || eventData === null || !("action" in eventData)) {
    return null;
  }
  const action = eventData.action;
  return typeof action === "string" ? action : null;
}
