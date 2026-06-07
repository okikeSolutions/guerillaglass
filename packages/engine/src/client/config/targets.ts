/** Supported native and stub engine targets. */
export type EngineTarget =
  | "macos-swift"
  | "windows-native"
  | "linux-native"
  | "windows-stub"
  | "linux-stub";

/** Windows native engine binary file name. */
export const WINDOWS_NATIVE_BINARY = "guerillaglass-engine-windows.exe";

/** Linux native engine binary file name. */
export const LINUX_NATIVE_BINARY = "guerillaglass-engine-linux";
