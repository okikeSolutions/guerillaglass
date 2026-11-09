// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { paraglideMiddleware } from "../src/paraglide/server.js";
import { getLocale, strategy } from "../src/paraglide/runtime.js";
import { Hero } from "../src/components/Hero";

function missingBarrierSignal(): never {
  throw new Error("Barrier not initialized");
}

const renderRequest = (request: Request, signal: () => void, other: Promise<void>) =>
  paraglideMiddleware(request, async () => {
    const before = getLocale();
    signal();
    await other;
    expect(getLocale()).toBe(before);
    return new Response(
      renderToString(
        <html lang={getLocale()}>
          <body>
            <Hero />
          </body>
        </html>,
      ),
      { headers: { "Content-Type": "text/html" } },
    );
  });

describe("request-scoped public localization", () => {
  it("uses SSR-readable strategies instead of localStorage", () => {
    expect(strategy).toEqual(["cookie", "preferredLanguage", "baseLocale"]);
  });

  it("keeps concurrent German and English renders isolated across async work", async () => {
    let firstArrived: () => void = missingBarrierSignal;
    let secondArrived: () => void = missingBarrierSignal;
    const first = new Promise<void>((resolve) => {
      firstArrived = resolve;
    });
    const second = new Promise<void>((resolve) => {
      secondArrived = resolve;
    });
    const [german, english] = await Promise.all([
      renderRequest(
        new Request("https://example.test/", {
          headers: { "Accept-Language": "de-DE,de;q=0.9,en;q=0.5" },
        }),
        firstArrived,
        second,
      ),
      renderRequest(
        new Request("https://example.test/", { headers: { "Accept-Language": "en-US,en;q=0.9" } }),
        secondArrived,
        first,
      ),
    ]);
    const germanHtml = await german.text();
    expect(germanHtml).toContain('lang="de-DE"');
    expect(germanHtml).toContain("Bildschirm aufnehmen. Geschichte gestalten.");
    expect(germanHtml).not.toContain("Record your screen. Shape the story.");
    const englishHtml = await english.text();
    expect(englishHtml).toContain('lang="en-US"');
    expect(englishHtml).toContain("Record your screen. Shape the story.");
    expect(englishHtml).not.toContain("Bildschirm aufnehmen");
    expect(german.headers.get("Vary")).toContain("Accept-Language");
    expect(german.headers.get("Vary")).toContain("Cookie");
  });

  it("honors a supported locale cookie before browser preference", async () => {
    const response = await paraglideMiddleware(
      new Request("https://example.test/about", {
        headers: { Cookie: "PARAGLIDE_LOCALE=de-DE", "Accept-Language": "en-US" },
      }),
      () => new Response(getLocale()),
    );
    expect(await response.text()).toBe("de-DE");
  });
});
