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

## Test
```bash
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
