# Guerilla Glass Convex Backend (Web App)

This folder contains Convex functions and Better Auth wiring for the `apps/web` TanStack Start app.

## Auth setup

- Better Auth is mounted through `convex/http.ts`.
- Auth provider config is in `convex/auth.config.ts`.
- Local Better Auth component install lives in `convex/betterAuth/`.
- Organization plugin is enabled in `convex/auth.ts`.

## Review backend

- Review session/comment/status handlers are implemented in `convex/review.ts`.
- Desktop bridge review calls now target these Convex functions.
