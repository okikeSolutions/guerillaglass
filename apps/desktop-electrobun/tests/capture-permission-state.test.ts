import { describe, expect, test } from "vitest";
import { capturePermissionState } from "@studio/view-model/capturePermissionState";

const grantedQuery = {
  isPending: false,
  isFetching: false,
  isSuccess: true,
  isError: false,
  data: { screenRecordingGranted: true },
};
describe("capture permission presentation", () => {
  test("distinguishes checking from a failed check and an OS denial", () => {
    expect(
      capturePermissionState({
        ...grantedQuery,
        isPending: true,
        isSuccess: false,
        data: undefined,
      }),
    ).toBe("checking");
    expect(
      capturePermissionState({ ...grantedQuery, isSuccess: false, isError: true, data: undefined }),
    ).toBe("failed");
    expect(
      capturePermissionState({ ...grantedQuery, data: { screenRecordingGranted: false } }),
    ).toBe("denied");
  });
  test("never labels a failed refresh as ready from stale granted data", () => {
    expect(capturePermissionState({ ...grantedQuery, isSuccess: false, isError: true })).toBe(
      "failed",
    );
    expect(capturePermissionState({ ...grantedQuery, isFetching: true })).toBe("checking");
    expect(capturePermissionState(grantedQuery)).toBe("granted");
  });
  test("missing data without a check result stays unknown", () => {
    expect(capturePermissionState({ ...grantedQuery, isSuccess: false, data: undefined })).toBe(
      "unknown",
    );
  });
});
