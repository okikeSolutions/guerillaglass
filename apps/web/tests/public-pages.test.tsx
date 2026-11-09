import { afterEach, describe, expect, it, vi } from "vitest";
import nativeManifest from "../../../Package.swift?raw";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Hero } from "../src/components/Hero";
import { getRouter } from "../src/router";
import * as m from "../src/paraglide/messages.js";

// Native modal focus containment is verified in the browser. The DOM environment
// supplies the modal lifecycle here so this test can exercise link dismissal.
const originalDialogMethods = ["showModal", "close"].map((name) => ({
  name,
  descriptor: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, name),
}));

function installDialogLifecycle() {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const { name, descriptor } of originalDialogMethods) {
    if (descriptor) {
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    } else {
      Reflect.deleteProperty(HTMLDialogElement.prototype, name);
    }
  }
});

describe("public website", () => {
  it("keeps both public platform answers aligned with the native deployment target", () => {
    const minimum = nativeManifest.match(/\.macOS\(\.v(\d+)\)/)?.[1];
    expect(minimum).toBeDefined();
    for (const locale of ["en-US", "de-DE"] as const) {
      expect(m.web_ui_faq_platform_a(undefined, { locale })).toContain(`macOS ${minimum}`);
    }
  });
  it("loads the real home route without a configured hosted service or auth request", async () => {
    vi.stubEnv("VITE_CONVEX_URL", "");
    vi.stubGlobal("scrollTo", vi.fn());
    const fetch = vi.fn().mockRejectedValue(new Error("Hosted service offline"));
    vi.stubGlobal("fetch", fetch);
    const router = getRouter();
    router.update({ history: createMemoryHistory({ initialEntries: ["/"] }) });
    await router.load();
    render(<RouterProvider router={router} />);
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Record your screen. Shape the story.",
      }),
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers an honest setup destination and keeps answers next to their questions", () => {
    render(<Hero />);
    expect(screen.getByRole("link", { name: "Build for macOS" }).getAttribute("href")).toContain(
      "#quick-start",
    );
    expect(screen.queryByText("Choose Creator Pro")).toBeNull();
    const question = screen.getByText("How do I get the app?");
    const answer = question.closest("details");
    expect(answer).not.toBeNull();
    expect(within(answer!).getByText(/There is no packaged release yet/)).toBeTruthy();
  });

  it("closes mobile navigation after choosing a destination and restores its trigger", () => {
    installDialogLifecycle();
    render(<Hero />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Workflow" }));
    expect((dialog as HTMLDialogElement).open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});
