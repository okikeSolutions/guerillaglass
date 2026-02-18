# Linux Engine Stub

This is a protocol-compatible stub sidecar for Linux parallel development.

It simulates the current engine protocol over stdio and does not perform real capture/export.

## Usage

```bash
GG_ENGINE_TARGET=linux-stub bun run desktop:dev
```

## Purpose

- Unblock UI and protocol workflow development before native Linux capture implementation.
- Keep method/result envelope behavior aligned with `packages/engine-protocol`.

## Not Implemented

- Real screen/window capture
- Real microphone/system audio capture
- Real export pipeline execution
- Real project file IO
