# @guerillaglass/web-landing

TanStack Start landing app for Guerilla Glass with Convex wiring.

## Dev

```bash
bun run landing:dev
```

This runs both:

- `vite dev --port 3000`
- `convex dev`

Set `VITE_CONVEX_URL` in `.env.local` (see `.env.example`) to enable the Convex demo route at `/anotherPage`.
