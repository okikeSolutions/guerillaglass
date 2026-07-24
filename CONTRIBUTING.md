# Contributing to Guerilla Glass

Thanks for your interest in contributing. Guerilla Glass is a cross-platform creator recorder/editor with a hybrid setup: Electrobun desktop shell + native per-OS engines behind a shared protocol.

## Product direction

- Professional creator workflow: `Record -> Edit -> Deliver`
- Editor-first shell: transport, viewer, timeline, inspector
- Cinematic defaults with manual overrides

## Development

- Bun 1.3+
- Rust toolchain
- Swift 5.10+ (for macOS engine work)
- macOS 13.0+ (required for full native macOS capture/export flow and full gate)

## TypeScript tooling

`bun install` patches the TypeScript 7 native compiler with `@effect/tsgo`; `tsc` should report a version ending in `+effect-tsgo.<version>`. Keep the existing `@effect/language-service` plugin entries in `tsconfig` files because that remains the plugin identifier used by `@effect/tsgo`.

For VS Code-compatible editors, configure the workspace to use the patched compiler:

```json
{
  "js/ts.experimental.useTsgo": true,
  "js/ts.tsdk.path": "./node_modules/typescript/bin",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true,
  "js/ts.tsdk.additionalLocations": ["./node_modules/typescript/bin"]
}
```

## Build

```bash
bun run swift:build
bun run desktop:build
```

## Run desktop shell

```
bun run desktop:dev
```

## Build desktop shell bundle

```
bun run desktop:build
```

## Permissions

- Screen Recording is required to preview capture.
- Microphone access is required when mic capture is enabled.

## Repository guidance

Read [`AGENTS.md`](AGENTS.md) for architecture and generated-file ownership, [`docs/CHANGE_MAP.md`](docs/CHANGE_MAP.md) for change propagation, and [`REVIEW.md`](REVIEW.md) before opening a pull request.

## Test

```bash
bun run repo:check
bun run gate
```

For narrower iteration:

```bash
bun run swift:test
bun run desktop:test
```

## Style

- SwiftFormat and SwiftLint configurations live at repo root.

## Pull requests (agent-friendly)

- Use small, scoped PRs (UI, capture, export, docs, tooling).
- Run `bun run gate` before opening a PR (format, lint, tests, build).
- Include screenshots for UI changes.
- Split commits by feature area (follow existing `feat:`, `docs:`, `chore:` style).
