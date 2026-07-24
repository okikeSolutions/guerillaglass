# Web agent guide

Read the root `AGENTS.md` first.

The web app is the hosted review/auth shell, not the local media plane. TanStack Start routes/components live under `src`; Convex functions and hosted data live under `convex`; shared hosted DTOs belong in `packages/review-protocol`.

## Rules

- Do not make web availability, authentication, billing, or Convex connectivity a prerequisite for desktop capture/edit/export.
- Do not place raw local media paths or local engine credentials in hosted contracts.
- Keep auth-provider casts and compatibility workarounds narrow, documented, and removable when upstream types align.
- Route user-visible strings through shared localization sources and do not commit generated Paraglide output.
- Prefer versionable review-protocol DTOs over ad hoc route payloads.
- Add tests when the package has behavior to test; a package with no tests should still typecheck and build cleanly.

## Checks

```bash
bun run i18n:compile:web
bun run web:typecheck
bun run web:build
cd apps/web && bun run test:ci -- --passWithNoTests
```
