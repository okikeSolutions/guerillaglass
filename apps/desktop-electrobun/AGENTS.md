# Desktop agent guide

Read the root `AGENTS.md` first.

## Boundaries

- `src/bun`: Electrobun host, one scoped Effect runtime, native engine/media services, menus/tray/windows.
- `src/mainview`: React Creator Studio renderer.
- `src/shared`: bridge contracts, command and shortcut registries, localization-facing shared models.
- `tests`: unit, integration, parity, and Vitest Browser interaction coverage.

The renderer talks through typed bridge/query boundaries. Do not import Bun or native filesystem/process APIs into renderer code. Keep `requestHandlers` thin; business flows belong in services composed by `AppRuntime`/`AppLayer`.

## UI conventions

- Preserve the editor-first `Capture -> Edit -> Deliver` shell and persistent timeline.
- Use shared UI primitives and semantic tone tokens instead of one-off styling.
- Route strings through `messages/en-US.json` and `messages/de-DE.json` and the existing localization model.
- Use the shared shortcut registry; honor overrides, conflict validation, editable-target scoping, and single-key-shortcut policy.
- Interactive timeline and separator controls require keyboard semantics, pointer capture where appropriate, visible focus, and reduced-motion behavior.
- Keep degraded engine/permission/host-dialog states visible and actionable.

## State and media

- Pure edit semantics belong in domain command modules, not React components.
- Keep display-clock rendering separate from frame-quantized edit decisions.
- Never send raw local media paths to the renderer; use tokenized loopback media URLs.
- Preview semantics must match persisted project state and native export.

## Testing

Use unit tests for pure commands and model parsing, component tests for view dispatch/state, Vitest Browser for pointer/keyboard/media interactions, and parity tests for real engine-client behavior.

```bash
bun run i18n:compile
bun run desktop:typecheck
bun run desktop:test
bun run desktop:test:ui
bun run desktop:test:e2e
bun run desktop:acceptance
```

UI-facing work is not complete from code-level tests alone. On macOS, run the
packaged Electrobun application through `desktop:acceptance`, inspect its runtime
report and browser screenshots, and exercise the affected real-app workflow. Use
`desktop:acceptance:screenshot` when Screen Recording permission is available.
