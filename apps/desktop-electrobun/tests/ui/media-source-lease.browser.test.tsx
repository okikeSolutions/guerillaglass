import React, { useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  useRecordingMediaSourceErrorRecovery,
  useRecordingMediaSourceLease,
} from "../../src/mainview/app/studio/hooks/useRecordingMediaSource";

type BridgeWindow = Window & {
  ggGrantMediaSourceCapability?: (filePath: string) => Promise<string>;
  ggResolveMediaSourceURL?: (filePath: string, capabilityToken: string) => Promise<string>;
};

let container: HTMLDivElement;
let root: Root | null;
let queryClient: QueryClient;

function waitFor(assertion: () => void, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      try {
        assertion();
        resolve();
      } catch (error) {
        if (Date.now() - startedAt > timeoutMs) {
          reject(error);
          return;
        }
        setTimeout(check, 20);
      }
    };
    check();
  });
}

function installMediaBridge() {
  let resolveCount = 0;
  const bridgeWindow = window as BridgeWindow;
  bridgeWindow.ggGrantMediaSourceCapability = async () => "capability-token";
  bridgeWindow.ggResolveMediaSourceURL = async () => {
    resolveCount += 1;
    return `http://127.0.0.1:34999/media/token-${resolveCount}`;
  };
  return {
    get resolveCount() {
      return resolveCount;
    },
  };
}

function renderProbe(recordingURL = "/tmp/guerillaglass-recording.mov") {
  function Probe() {
    const lease = useRecordingMediaSourceLease(recordingURL);
    const handleMediaError = useRecordingMediaSourceErrorRecovery(lease.source, lease.refresh);
    useEffect(() => {
      const sourceNode = document.querySelector("[data-media-source]");
      sourceNode?.setAttribute("data-media-source", lease.source ?? "");
    }, [lease.source]);

    return (
      <div>
        <span data-media-source={lease.source ?? ""} />
        <video
          data-testid="recording-video"
          data-src={lease.source ?? ""}
          onError={handleMediaError}
        />
      </div>
    );
  }

  root = createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
}

function mediaSource(): string {
  return container.querySelector("[data-media-source]")?.getAttribute("data-media-source") ?? "";
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = null;
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
});

afterEach(() => {
  root?.unmount();
  queryClient.clear();
  container.remove();
  const bridgeWindow = window as BridgeWindow;
  delete bridgeWindow.ggGrantMediaSourceCapability;
  delete bridgeWindow.ggResolveMediaSourceURL;
});

describe("recording media source leases", () => {
  test("refetches the media lease when the edit video reports a source load error", async () => {
    const bridge = installMediaBridge();

    renderProbe();

    await waitFor(() => expect(mediaSource()).toContain("token-1"));
    expect(bridge.resolveCount).toBe(1);

    const video = container.querySelector("[data-testid='recording-video']");
    video?.dispatchEvent(new Event("error", { bubbles: true }));

    await waitFor(() => expect(mediaSource()).toContain("token-2"));
    expect(bridge.resolveCount).toBe(2);
  });

  test("does not refetch repeatedly for duplicate errors on the same media source", async () => {
    const bridge = installMediaBridge();

    renderProbe();

    await waitFor(() => expect(mediaSource()).toContain("token-1"));
    expect(bridge.resolveCount).toBe(1);

    const video = container.querySelector("[data-testid='recording-video']");
    video?.dispatchEvent(new Event("error", { bubbles: true }));
    video?.dispatchEvent(new Event("error", { bubbles: true }));

    await waitFor(() => expect(mediaSource()).toContain("token-2"));
    expect(bridge.resolveCount).toBe(2);
  });

  test("refetches the media lease when the edit view remounts", async () => {
    const bridge = installMediaBridge();

    renderProbe();
    await waitFor(() => expect(mediaSource()).toContain("token-1"));
    expect(bridge.resolveCount).toBe(1);

    root?.unmount();
    root = null;
    container.replaceChildren();

    renderProbe();

    await waitFor(() => expect(mediaSource()).toContain("token-2"));
    expect(bridge.resolveCount).toBe(2);
  });
});
