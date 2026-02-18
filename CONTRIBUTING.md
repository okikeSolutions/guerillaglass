# Contributing to guerillaglass

Thanks for your interest in contributing. This repository uses a hybrid setup: Electrobun desktop shell + Swift native engine.

## Development
- macOS 13.0+
- Swift 5.10+
- Bun 1.3+

## Build
```
swift build
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
```
swift test
```

## Style
- SwiftFormat and SwiftLint configurations live at repo root.

## Pull requests (agent-friendly)
- Use small, scoped PRs (UI, capture, export, docs, tooling).
- Run `Scripts/full_gate.sh` before opening a PR (format, lint, build).
- Include screenshots for UI changes.
- Split commits by feature area (follow existing `feat:`, `docs:`, `chore:` style).
