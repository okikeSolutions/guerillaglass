import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "bun:test";

const indexHtmlPath = path.resolve(import.meta.dir, "../src/mainview/index.html");

describe("desktop renderer CSP", () => {
  test("allows loopback image and media sources for live preview", async () => {
    const indexHtml = await readFile(indexHtmlPath, "utf8");

    expect(indexHtml).toContain(
      "img-src 'self' data: blob: http://127.0.0.1:* http://localhost:*;",
    );
    expect(indexHtml).toContain("media-src 'self' http://127.0.0.1:* http://localhost:*;");
    expect(indexHtml).toContain(
      "connect-src 'self' ws://127.0.0.1:* ws://localhost:* http://127.0.0.1:* http://localhost:*;",
    );
  });
});
