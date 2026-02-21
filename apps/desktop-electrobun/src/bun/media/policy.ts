import path from "node:path";

const supportedMediaExtensions = [".mov", ".mp4", ".m4v", ".webm"] as const;

export const mediaExtensions = new Set<string>(supportedMediaExtensions);

const mediaMimeByExtension: Record<string, string> = {
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
};

export function mediaExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

export function isSupportedMediaPath(filePath: string): boolean {
  return mediaExtensions.has(mediaExtension(filePath));
}

export function mediaTypeForPath(filePath: string): string {
  return mediaMimeByExtension[mediaExtension(filePath)] ?? "application/octet-stream";
}
