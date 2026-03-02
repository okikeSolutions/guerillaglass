# Guerilla Glass Convex Backend (Web App)

This folder contains Convex functions and Better Auth wiring for the `apps/web` TanStack Start app.

## Auth setup

- Better Auth is mounted through `convex/http.ts`.
- Auth provider config is in `convex/auth.config.ts`.
- Local Better Auth component install lives in `convex/betterAuth/`.
- Organization plugin is enabled in `convex/auth.ts`.
- Trusted origins are configured via `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated origins).

## Review backend

- Review session/comment/status handlers are implemented in `convex/review.ts`.
- Desktop bridge review calls now target these Convex functions.
- Role-aware authorization is enforced for review reads/mutations (`owner`, `admin`, `member`, `viewer`).

## Required Convex env vars (dev/prod)

- `SITE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_TRUSTED_ORIGINS`
