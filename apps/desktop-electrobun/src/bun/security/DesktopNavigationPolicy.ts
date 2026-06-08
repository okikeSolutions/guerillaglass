export const DEFAULT_DEV_SERVER_PORT = 5173;

export function devServerURL(port: number): string {
  return `http://localhost:${port}`;
}

/** Returns Electrobun navigation rules for the privileged local main view. */
export function buildMainViewNavigationRules(
  channel: string,
  devServerPort = DEFAULT_DEV_SERVER_PORT,
): string {
  const rules = ["views://mainview/*"];
  if (channel === "dev") {
    rules.push(`${devServerURL(devServerPort)}/*`);
  }
  return JSON.stringify(rules);
}
