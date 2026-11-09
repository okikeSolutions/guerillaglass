export type CapturePermissionState = "checking" | "failed" | "granted" | "denied" | "unknown";

/** Transport failure is distinct from a successfully checked OS denial. */
export function capturePermissionState(query: {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  data: { screenRecordingGranted: boolean } | undefined;
}): CapturePermissionState {
  if (query.isPending || query.isFetching) {
    return "checking";
  }
  if (query.isError) {
    return "failed";
  }
  if (!query.isSuccess || !query.data) {
    return "unknown";
  }
  return query.data.screenRecordingGranted ? "granted" : "denied";
}
