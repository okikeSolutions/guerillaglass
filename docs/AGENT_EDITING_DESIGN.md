# External agent editing milestone

This is the implementation and review specification for the five-step milestone requested on 2026-11-07. It explicitly prioritizes Agent Mode editing over unrelated hosted delivery work.

## Ordered implementation

1. Accept a versioned externally authored edit plan. A plan identifies its base project revision and source recording revision. Its timeline contains stable scene/clip IDs, source ranges, and gaps. Validate non-empty plans, unique IDs, finite positive ranges/durations, and source bounds before any mutation. Reordering and repeating footage are supported. No four-beat narrative structure is required.
2. Apply using the existing native timeline and export machinery. Reject stale revisions and mismatched sources. Apply saves an editable project. Explicit current-project export consumes that saved timeline and checks the requested revision; the legacy source-export behavior remains backward compatible.
3. Provide a thin external-agent command adapter for review, validation, apply, and export. JSON input/output, typed failures, authenticated loopback transport, and scoped process cleanup make the commands usable by shell-capable agents. Agents and LLM providers remain external.
4. Support saved-project review and revision with sequential ownership. A native project lease prevents two engine processes from editing the same project. Close the desktop project/application before running the adapter; reopen after the adapter exits. Review returns the saved timeline, settings, source metadata, and revision. Revisions preserve untouched scene IDs. Stale writes fail rather than silently replacing newer edits. Save As must acquire destination ownership.
5. Persist per-scene manual camera keyframes with each clip. Times are source-relative seconds, centers are normalized oriented-source coordinates, zoom is bounded, and affine transform interpolation is linear with endpoint holds. Manual camera overrides supersede automatic camera planning for that scene. Preview and export use the same interpolation and framing semantics, including reordered/repeated source ranges and gaps. Older projects default to automatic camera behavior.

## Completion evidence

- Contract, native validation, stale-plan, source-mismatch, ownership, saved-project reopen, and revision tests.
- A synthetic native workflow authors an arbitrary plan, validates/applies it, exports it, reopens it, makes a second revision, rejects the stale first plan, and verifies rendered scene/gap/camera output.
- Generated bindings are deterministic and both native consumers compile. Foundation targets report the new operations unsupported.
- Packaged desktop acceptance plus native-window interaction verifies that an adapter-authored project reopens and previews scene camera overrides.
- The two-axis code review compares the feature branch with main, using this document as the originating spec. Effect code is audited against the requested Effect skill and docs/EFFECT_PRACTICES.md.

## First-version scope

One recording per project, macOS production media, ordered clip/gap timelines, project-global framing and auto-zoom, and scene camera overrides. Captions, overlays, extra audio tracks, multiple source assets, built-in agent orchestration, and hosted collaboration are outside this milestone.
