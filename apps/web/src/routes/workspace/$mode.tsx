import { Link, createFileRoute, redirect } from "@tanstack/react-router";

const workspaceModes = ["capture", "edit", "deliver"] as const;
type WorkspaceMode = (typeof workspaceModes)[number];

function isWorkspaceMode(value: string): value is WorkspaceMode {
  return workspaceModes.includes(value as WorkspaceMode);
}

export const Route = createFileRoute("/workspace/$mode")({
  beforeLoad: ({ context, params }) => {
    if (!isWorkspaceMode(params.mode)) {
      throw redirect({ to: "/workspace/capture" });
    }
    const authContext = context as { isAuthenticated?: boolean };
    if (!authContext.isAuthenticated) {
      throw redirect({ to: "/" });
    }
  },
  component: WorkspaceRoute,
});

function WorkspaceRoute() {
  const { mode } = Route.useParams();
  const normalizedMode = mode as WorkspaceMode;

  return (
    <main className="landing-shell">
      <section className="status-card">
        <p className="eyebrow">Authenticated Workspace</p>
        <h1>{normalizedMode[0].toUpperCase() + normalizedMode.slice(1)} Mode</h1>
        <p>
          Product-mode workspace routes are account-gated. This route only resolves when a valid
          Better Auth session token is present.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/workspace/capture">
            Capture
          </Link>
          <Link className="button button-primary" to="/workspace/edit">
            Edit
          </Link>
          <Link className="button button-primary" to="/workspace/deliver">
            Deliver
          </Link>
          <Link className="button button-ghost" to="/">
            Back to Landing
          </Link>
        </div>
      </section>
    </main>
  );
}
