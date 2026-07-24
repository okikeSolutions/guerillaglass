import type { Path } from "effect";

const supportedMediaExtensions = [".mov", ".mp4", ".m4v", ".webm"] as const;

/** Media extensions that can be resolved through the desktop bridge. */
export const mediaExtensions = new Set<string>(supportedMediaExtensions);

const mediaMimeByExtension: Record<string, string> = {
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
};

/** Returns the normalized extension for a media path. */
export function mediaExtension(path: Pick<Path.Path, "extname">, filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/** Returns whether the path extension is supported media. */
export function isSupportedMediaPath(path: Pick<Path.Path, "extname">, filePath: string): boolean {
  return mediaExtensions.has(mediaExtension(path, filePath));
}

/** Returns the response MIME type for a supported media path. */
export function mediaTypeForPath(path: Pick<Path.Path, "extname">, filePath: string): string {
  return mediaMimeByExtension[mediaExtension(path, filePath)] ?? "application/octet-stream";
}
