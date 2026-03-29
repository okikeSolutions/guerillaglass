export function toMediaSourceURL(recordingURL: string | null): string | null {
  if (!recordingURL) {
    return null;
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(recordingURL);
  const isWindowsDrivePath = /^[a-zA-Z]:[\\/]/.test(recordingURL);
  if (hasScheme && !isWindowsDrivePath) {
    return recordingURL;
  }

  const slashNormalized = recordingURL.split("\\").join("/");
  const isWindowsDrivePathNormalized = /^[a-zA-Z]:\//.test(slashNormalized);
  const prefixedPath = slashNormalized.startsWith("/")
    ? slashNormalized
    : isWindowsDrivePathNormalized
      ? `/${slashNormalized}`
      : `/${slashNormalized}`;
  const encodedPath = prefixedPath
    .split("/")
    .map((segment: string) => {
      if (segment === "" || /^[a-zA-Z]:$/.test(segment)) {
        return segment;
      }
      return encodeURIComponent(segment);
    })
    .join("/");
  return `file://${encodedPath}`;
}
