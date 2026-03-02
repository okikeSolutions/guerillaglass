# @guerillaglass/web

TanStack Start app for Guerilla Glass with Convex + Better Auth (local install) and organization
plugin support.

## Dev

```bash
bun run web:dev
```

This runs both:

- `vite dev --port 3000`
- `convex dev`

Set the web env vars in `.env.local` (see `.env.example`) and Convex env vars (`SITE_URL`,
`BETTER_AUTH_SECRET`) in your deployment.
