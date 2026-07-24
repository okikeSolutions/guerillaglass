export const studioDiagnosticsQueryKey = "ggDiagnostics";

export type StudioDiagnosticsValue = string | number | boolean | null;

export function isStudioDiagnosticsEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.get(studioDiagnosticsQueryKey) === "1") {
    return true;
  }

  if (search.startsWith("#")) {
    const fragmentParams = new URLSearchParams(search.slice(1));
    return fragmentParams.get(studioDiagnosticsQueryKey) === "1";
  }

  return false;
}

export function appendStudioDiagnosticsQuery(url: string, enabled: boolean): string {
  if (!enabled) {
    return url;
  }

  // Electrobun's bundled `views://` loader resolves both query strings and
  // fragments as part of the resource path. Bundled renderers receive this
  // runtime-only flag through the BrowserWindow preload instead.
  if (url.startsWith("views://")) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${studioDiagnosticsQueryKey}=1`;
}
