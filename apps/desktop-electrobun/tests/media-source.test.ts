import { describe, expect, test } from "bun:test";
import { toMediaSourceURL } from "../src/mainview/app/studio/model/mediaSourceUrl";

describe("media source URL", () => {
  test("returns null when recording URL is empty", () => {
    expect(toMediaSourceURL(null)).toBeNull();
  });

  test("keeps scheme-based URLs unchanged", () => {
    expect(toMediaSourceURL("https://example.com/take.mov")).toBe("https://example.com/take.mov");
    expect(toMediaSourceURL("file:///tmp/take.mov")).toBe("file:///tmp/take.mov");
  });

  test("maps local paths to encoded file URLs", () => {
    expect(toMediaSourceURL("/tmp/Guerilla Glass/take 1.mov")).toBe(
      "file:///tmp/Guerilla%20Glass/take%201.mov",
    );
    expect(toMediaSourceURL("/tmp/Guerilla Glass/take #1?.mov")).toBe(
      "file:///tmp/Guerilla%20Glass/take%20%231%3F.mov",
    );
    expect(toMediaSourceURL("tmp/take.mov")).toBe("file:///tmp/take.mov");
    expect(toMediaSourceURL(String.raw`C:\Capture Files\take #1.mov`)).toBe(
      "file:///C:/Capture%20Files/take%20%231.mov",
    );
  });
});
