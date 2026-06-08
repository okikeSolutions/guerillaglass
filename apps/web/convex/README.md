# Guerilla Glass Web Convex Functions

Convex backend root for hosted Guerilla Glass web surfaces.

Scope:

- Better Auth / Convex identity integration
- Review and collaboration metadata
- Future billing and entitlement projection
- Hosted APIs that support `Deliver` workflows

Boundary rule:

- Convex-hosted features must not gate local desktop capture, edit, project IO, or deterministic export.
- Local media protocol remains in `packages/engine` and native sidecars.
- Review payload contracts live in `packages/review-protocol`.

Useful commands:

```bash
cd apps/web
bun run generate:auth
bun run dev
```

See Convex docs for function/runtime details: https://docs.convex.dev/functions
