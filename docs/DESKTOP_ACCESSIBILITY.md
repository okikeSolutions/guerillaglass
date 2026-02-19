# Desktop Accessibility and Hotkey Policy

This document defines the accessibility and keyboard shortcut baseline for the Electrobun desktop shell (`apps/desktop-electrobun`).

## Scope

- Focus visibility and keyboard operation for all core editor controls.
- Reduced-motion and increased-contrast behavior.
- Global hotkey behavior and safety boundaries.
- Verification steps for CI/local checks.

## Standards Alignment

The shell targets practical conformance with relevant WCAG 2.2 AA desktop concerns:

- 1.4.3 Contrast (Minimum)
- 1.4.11 Non-text Contrast
- 2.1.1 Keyboard
- 2.1.4 Character Key Shortcuts
- 2.4.3 Focus Order
- 2.4.7 Focus Visible
- 2.2.2 Pause, Stop, Hide (motion minimization where applicable)

## Focus and Keyboard Rules

- Use visible `:focus-visible` treatment for native and custom interactive elements.
- Do not remove focus outlines without a replacement indicator.
- Keep mode navigation, transport controls, timeline interactions, and pane resizers keyboard-accessible.
- Custom separators must expose:
  - `role="separator"`
  - `aria-orientation`
  - `aria-valuemin`
  - `aria-valuemax`
  - `aria-valuenow`

Keyboard bindings for separators:

- Vertical pane separators: `ArrowLeft` / `ArrowRight`, `Home`, `End`
- Timeline height separator: `ArrowUp` / `ArrowDown`, `Home`, `End`
- `Shift` modifier applies a larger step size.

Drag behavior for separators and timeline controls:

- Pointer interactions use Pointer Events with pointer capture (not mouse-only listeners).
- Drag updates are throttled via TanStack Pacer (`@tanstack/react-pacer`) at a frame-friendly cadence (`wait: 16`, leading + trailing).
- `pointerup` paths flush pending throttled work before ending drag; `pointercancel` paths cancel pending work without applying a new coordinate.

## Motion and Contrast Rules

- Respect `prefers-reduced-motion: reduce` by minimizing transitions and animations.
- Respect `prefers-contrast: more` and `forced-colors: active` with stronger visible boundaries and focus indicators.
- Avoid relying on blur/translucency for essential state communication.

## Global Hotkey Policy

Global hotkeys are registered through TanStack Hotkeys in the renderer.

Always enabled (including input fields):

- `Mod+S` save project
- `Mod+Shift+S` save project as
- `Mod+E` export
- `Escape` clear transient selection/notice state

Single-key hotkeys:

- `Space` play/pause
- `R` record toggle
- `I` set trim in
- `O` set trim out

Single-key safety requirements:

- User-toggleable in Capture Inspector (`Enable single-key shortcuts`).
- Must not fire when focus is within interactive controls (`input`, `textarea`, `select`, `button`, links, tab/menu/button-like roles, contenteditable).
- Timeline arrow-key behavior remains local to the timeline surface and is not globalized.

## Verification

Run these checks before merge when accessibility-related shell logic changes:

```bash
bun run gate
bun run desktop:test:coverage
bun run desktop:test:ui
```

Playwright smoke coverage in `apps/desktop-electrobun/playwright/tests/studio-shell.smoke.ts` includes:

- Keyboard tab order checks for mode links.
- Keyboard resizing checks for pane and timeline separators.
- Pointer drag checks for pane and timeline separators.
- Timeline pointer-cancel stability checks (no cancel-coordinate jump).
- Single-key hotkey toggle and interactive-focus scoping checks.
- Reduced-motion and increased-contrast media emulation assertions.

## Change Review Checklist

- Are all new interactive controls keyboard reachable?
- Is focus visible in both default and high-contrast/forced-color scenarios?
- Do any single-key shortcuts trigger unexpectedly while focus is on interactive controls?
- Are new strings localized (`en-US`, `de-DE`)?
- Did `bun run gate` pass?
