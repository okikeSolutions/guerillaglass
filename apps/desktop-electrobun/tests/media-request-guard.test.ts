import { describe, expect, test } from "vitest";
import { HttpServerRequest } from "effect/http";
import { guardMediaServerRequest } from "../src/bun/security/MediaServerRequestGuard";

describe("media renderer origin guard", () => {
  test("accepts the exact configured bundled renderer origin on loopback", () => {
    const request = HttpServerRequest.fromWeb(
      new Request("http://127.0.0.1/media/test", {
        headers: { origin: "views://mainview", "sec-fetch-site": "cross-site" },
      }),
    );
    expect(guardMediaServerRequest(request)).toEqual({ allowed: true });
  });

  test("rejects custom-scheme authority lookalikes and non-loopback destinations", () => {
    for (const origin of [
      "views://evil",
      "views://mainview.evil",
      "views://mainview:5173",
      "views://mainview/",
      "views://mainview?x=1",
      "views://mainview#x",
      "views://user@mainview",
      "https://untrusted.example",
    ]) {
      const request = HttpServerRequest.fromWeb(
        new Request("http://127.0.0.1/media/test", { headers: { origin } }),
      );
      expect(guardMediaServerRequest(request)).toMatchObject({ allowed: false, status: 403 });
    }
    const remote = HttpServerRequest.fromWeb(
      new Request("http://external.example/media/test", {
        headers: { origin: "views://mainview" },
      }),
    );
    expect(guardMediaServerRequest(remote)).toMatchObject({ allowed: false, status: 403 });
  });
});
