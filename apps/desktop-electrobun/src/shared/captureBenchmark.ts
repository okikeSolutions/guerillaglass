export const captureBenchmarkQueryKey = "ggCaptureBenchmark";
export const captureBenchmarkWindowTitle = "GG Capture Benchmark";

export function isCaptureBenchmarkEnabledFromSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  if (params.get(captureBenchmarkQueryKey) === "1") {
    return true;
  }

  if (search.startsWith("#")) {
    const fragmentParams = new URLSearchParams(search.slice(1));
    return fragmentParams.get(captureBenchmarkQueryKey) === "1";
  }

  return false;
}

export function appendCaptureBenchmarkQuery(url: string, enabled: boolean): string {
  if (!enabled) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${captureBenchmarkQueryKey}=1`;
}
