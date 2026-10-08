import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

const indexHtmlPath = path.resolve(import.meta.dirname, "../src/mainview/index.html");

function parseCsp(html: string): Map<string, Set<string>> {
  const policy = html.match(
    /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/iu,
  )?.[1];
  if (!policy) {
    throw new Error("Desktop renderer is missing its Content-Security-Policy meta directive");
  }

  return new Map(
    policy
      .split(";")
      .map((directive) => directive.trim().split(/\s+/u))
      .filter(([name]) => name)
      .map(([name, ...sources]) => {
        if (!name) {
          throw new Error("CSP directive is missing its name");
        }
        return [name, new Set(sources)];
      }),
  );
}

describe("desktop renderer content security policy", () => {
  test("limits live preview and bridge traffic to local loopback origins", async () => {
    const directives = parseCsp(await readFile(indexHtmlPath, "utf8"));

    expect(directives.get("img-src")).toEqual(
      new Set(["'self'", "data:", "blob:", "http://127.0.0.1:*", "http://localhost:*"]),
    );
    expect(directives.get("media-src")).toEqual(
      new Set(["'self'", "http://127.0.0.1:*", "http://localhost:*"]),
    );
    expect(directives.get("connect-src")).toEqual(
      new Set([
        "'self'",
        "ws://127.0.0.1:*",
        "ws://localhost:*",
        "http://127.0.0.1:*",
        "http://localhost:*",
      ]),
    );
    expect(directives.get("object-src")).toEqual(new Set(["'none'"]));
    expect(directives.get("base-uri")).toEqual(new Set(["'none'"]));
  });
});
