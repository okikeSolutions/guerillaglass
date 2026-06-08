# Guerilla Glass Web

TanStack Start web app for the hosted Guerilla Glass surfaces: marketing, auth, review/collaboration, and future billing/entitlement workflows.

The web app is intentionally separate from the local desktop media plane. Local capture/edit/export must continue to work without hosted services.

## Stack

- TanStack Start + TanStack Router
- React 19
- Tailwind CSS
- Convex functions in `convex/`
- Better Auth integration scaffolding
- Shared UI package: `@guerillaglass/ui`
- Paraglide/Inlang localization generated into ignored `src/paraglide`

## Development

```bash
bun install
bun run i18n:compile:web
cd apps/web && bun run dev
```

## Build / Typecheck / Test

```bash
cd apps/web && bun run typecheck
cd apps/web && bun run build
cd apps/web && bun run test
```

These scripts generate Paraglide output before running, so generated files do not need to be committed.

## Localization

Source messages are shared at the repo root:

```txt
project.inlang/
messages/en-US.json
messages/de-DE.json
```

Generated web runtime/messages live at `src/paraglide` and are ignored by git.

## Convex

Convex functions live in `convex/`. The hosted review/auth/billing plane must stay downstream of the local creator core and must not add network requirements to desktop capture/edit/export.
