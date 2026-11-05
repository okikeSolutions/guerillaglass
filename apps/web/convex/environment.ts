import { ConfigProvider } from "effect";

// Convex exposes environment values through a proxy and rejects import.meta.
// Read known keys explicitly at the configuration boundary.
export const convexConfigProvider = () =>
  ConfigProvider.fromUnknown({ SITE_URL: process.env.SITE_URL });
