import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Suspense, useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/anotherPage")({
  component: ConvexDemoRoute,
});

function ConvexDemoRoute() {
  const convexUrl = (import.meta as ImportMeta & { env: { VITE_CONVEX_URL?: string } }).env
    .VITE_CONVEX_URL;

  if (!convexUrl) {
    return (
      <main className="landing-shell dark">
        <section className="status-card">
          <h1>Convex URL Missing</h1>
          <p>
            Set <code>VITE_CONVEX_URL</code> in <code>apps/web/.env.local</code> and run
            <code> bun run web:dev</code>.
          </p>
          <Link className="button button-ghost" to="/">
            Back to Landing
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="landing-shell dark">
      <section className="status-card">
        <h1>Convex Demo Route</h1>
        <p>
          This route proves the TanStack Start + Convex bridge is active for realtime review-plane
          features.
        </p>
        <Suspense fallback={<p>Loading Convex data...</p>}>
          <ConvexDemoPanel />
        </Suspense>
        <Link className="button button-ghost" to="/">
          Back to Landing
        </Link>
      </section>
    </main>
  );
}

function ConvexDemoPanel() {
  const {
    data: { numbers },
  } = useSuspenseQuery(convexQuery(api.myFunctions.listNumbers, { count: 12 }));
  const addNumber = useMutation(api.myFunctions.addNumber);
  const [mutationState, setMutationState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const onAddNumber = useCallback(async () => {
    setMutationState("saving");
    try {
      await addNumber({ value: Math.floor(Math.random() * 1000) });
      setMutationState("saved");
    } catch {
      setMutationState("error");
    }
  }, [addNumber]);

  return (
    <div className="demo-stack">
      <p>Current shared sample values: {numbers.length === 0 ? "none yet" : numbers.join(", ")}.</p>
      <button className="button button-primary" onClick={() => void onAddNumber()} type="button">
        Add Shared Sample
      </button>
      <p className="status-copy">
        Mutation status: <strong>{mutationState}</strong>
      </p>
    </div>
  );
}
