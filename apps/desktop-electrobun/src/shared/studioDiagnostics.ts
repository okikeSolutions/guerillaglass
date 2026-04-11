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

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${studioDiagnosticsQueryKey}=1`;
}
