import { useEffect, useMemo, useState } from "react";
import { RefreshCcw, ScreenShare, ShieldCheck, SquareTerminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engineApi } from "@/lib/engine";
import type { CaptureStatusResult, PermissionsResult, PingResult, SourcesResult } from "@guerillaglass/engine-protocol";

type AppState = {
  ping: PingResult | null;
  permissions: PermissionsResult | null;
  sources: SourcesResult | null;
  capture: CaptureStatusResult | null;
  error: string | null;
  loading: boolean;
};

const initialState: AppState = {
  ping: null,
  permissions: null,
  sources: null,
  capture: null,
  error: null,
  loading: true,
};

function permissionVariant(status: PermissionsResult | null): "default" | "destructive" | "secondary" {
  if (!status) {
    return "secondary";
  }
  if (!status.screenRecordingGranted) {
    return "destructive";
  }
  return "default";
}

export default function App() {
  const [state, setState] = useState<AppState>(initialState);

  const sourceSummary = useMemo(() => {
    if (!state.sources) {
      return "No source data loaded yet.";
    }
    return `${state.sources.displays.length} display(s) and ${state.sources.windows.length} window(s) available.`;
  }, [state.sources]);

  async function refreshAll() {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [ping, permissions, sources, capture] = await Promise.all([
        engineApi.ping(),
        engineApi.getPermissions(),
        engineApi.listSources(),
        engineApi.captureStatus(),
      ]);
      setState({ ping, permissions, sources, capture, error: null, loading: false });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Unknown engine error",
      }));
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  return (
    <div className="min-h-screen p-6 lg:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-white/10 bg-gradient-to-r from-cyan-500/15 via-teal-500/10 to-sky-500/15 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Hybrid architecture preview</p>
              <h1 className="mt-2 text-3xl font-semibold">Guerillaglass Desktop Shell</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Electrobun + React/Tailwind UI wired to a native Swift engine sidecar.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={permissionVariant(state.permissions)}>
                {state.permissions?.screenRecordingGranted ? "Screen Permission Ready" : "Screen Permission Needed"}
              </Badge>
              <Button onClick={() => void refreshAll()} disabled={state.loading}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {state.error ? (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Engine Error</CardTitle>
              <CardDescription>{state.error}</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SquareTerminal className="h-4 w-4" /> Engine
              </CardTitle>
              <CardDescription>{state.ping?.platform ?? "Unknown platform"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Protocol {state.ping?.protocolVersion ?? "-"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> Permissions
              </CardTitle>
              <CardDescription>Input: {state.permissions?.inputMonitoring ?? "unknown"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Mic: {state.permissions?.microphoneGranted ? "granted" : "not granted"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ScreenShare className="h-4 w-4" /> Sources
              </CardTitle>
              <CardDescription>{sourceSummary}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Displays + windows list comes from native API.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capture State</CardTitle>
              <CardDescription>{state.capture?.isRunning ? "Capturing" : "Idle"}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Recording: {state.capture?.isRecording ? "on" : "off"}
              </p>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Detected Windows</CardTitle>
            <CardDescription>
              This verifies end-to-end wiring: Electrobun UI -&gt; Bun bridge -&gt; Swift engine -&gt; ScreenCaptureKit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-left text-sm">
                <thead className="bg-secondary/60 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">App</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {(state.sources?.windows ?? []).slice(0, 8).map((window) => (
                    <tr key={window.id} className="border-t border-border/70">
                      <td className="px-3 py-2">{window.appName}</td>
                      <td className="px-3 py-2">{window.title || "(untitled)"}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {window.width} x {window.height}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
