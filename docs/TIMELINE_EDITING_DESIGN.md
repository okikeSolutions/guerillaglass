# Timeline Editing Design

## 1) Purpose

This document defines the implementation plan for the open "real edit operations" work in `docs/ROADMAP.md` §5:

- clip split
- clip delete
- clip lift
- clip move
- real ripple behavior

It is intentionally scoped to the current Guerilla Glass editor architecture:

- single-recording source asset baseline
- linked audio/video editing
- deterministic local-first export
- editor-first desktop workflow

This design does not attempt to turn the product into a full multitrack NLE. It provides the smallest data model and command surface that supports professional editor semantics without overbuilding.

---

## 2) Current State

The current implementation already has:

- a persisted timeline document in the engine/project contract
- segment-based playback remapping in the editor
- timeline toolbar affordances for `Select`, `Trim`, `Blade`, `Snap`, and `Ripple`
- timeline clip selection and trim handles
- export wiring that passes `timeline` to the engine

Relevant files:

- `packages/engine/src/protocol/index.ts`
- `apps/desktop-electrobun/src/mainview/app/studio/domain/timelineDomainModel.ts`
- `apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineDock.tsx`
- `apps/desktop-electrobun/src/mainview/app/studio/panels/TimelineSurface.tsx`
- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioController.ts`
- `apps/desktop-electrobun/src/mainview/app/studio/hooks/core/useStudioMutations.ts`
- `engines/macos-swift/modules/project/Timeline.swift`
- `engines/macos-swift/EngineService+Project.swift`

### 2.1) Current limitation

The timeline only stores contiguous clip segments:

- every segment maps to a source range inside the recording
- program time is inferred by summing segment durations
- the model cannot represent gaps explicitly

This is enough for playback, trims, and future reorder groundwork, but it is not enough for:

- lift without changing total duration
- non-ripple delete
- overwrite-style move
- visually representing empty program space

The current ripple toggle is therefore UI-only state, not a real edit-mode parameter.

---

## 3) Design Goals

### 3.1) Functional goals

- Support split, delete, lift, and move as deterministic pure timeline edits.
- Make ripple behavior real and testable.
- Preserve linked A/V editing across the current single-recording baseline.
- Keep export/playback driven by the same canonical timeline document.

### 3.2) Non-goals

- true multitrack editorial composition
- independent audio detaching/relinking
- transitions, compositing, or compound clips
- hosted collaboration semantics

---

## 4) Editor Semantics

The product should follow standard editor semantics:

- `Split`: cut a clip at the playhead into two clips.
- `Lift`: remove the selected material and leave a gap of equal duration.
- `Delete`: remove the selected material; behavior depends on ripple mode.
- `Move`: reposition selected material to another timeline location.
- `Ripple on`: downstream program time shifts when material is removed or inserted.
- `Ripple off`: program duration is preserved where possible via gaps/overwrite behavior.

### 4.1) Command rules

- `Delete` should respect the ripple toggle.
- `Lift` should always be explicit non-ripple removal.
- `Split` should be a structural edit only; it should not alter source timing beyond the cut point.
- `Move` should use insert semantics when ripple is enabled.
- `Move` should use position/overwrite semantics when ripple is disabled.

This keeps the product legible for creators who expect Premiere/Final Cut/Resolve-style editing, without exposing too many specialized commands up front.

---

## 5) Proposed Timeline Schema

### 5.1) Protocol shape

Replace the segment-only model with ordered timeline items.

```ts
type TimelineItem =
  | {
      kind: "clip";
      id: string;
      sourceAssetId: "recording";
      sourceStartSeconds: number;
      sourceEndSeconds: number;
      linkedAV: true;
    }
  | {
      kind: "gap";
      id: string;
      durationSeconds: number;
    };

type TimelineDocument = {
  version: 2;
  items: TimelineItem[];
};
```

### 5.2) Why this shape

- Ordered items keep the current editor mental model intact.
- Explicit gaps unlock lift and non-ripple workflows.
- Clip items remain simple and deterministic.
- The model stays compatible with a future extension to per-item overrides.

### 5.3) Future-safe extension points

The clip item should be designed so later work can add optional fields without another structural rewrite:

```ts
type TimelineClipOverrides = {
  cameraPlanId?: string;
  cropId?: string;
  highlightId?: string;
  redactionId?: string;
};
```

Those fields are not part of this implementation, but the move to item-based editing should not block them.

---

## 6) Migration Plan

### 6.1) Version upgrade

- Introduce `TimelineDocument.version = 2`.
- Migrate legacy `version = 1` documents from `segments` to `items`.
- Convert each old segment into a `kind: "clip"` item.
- Preserve item order exactly.

### 6.2) Engine migration behavior

- Project load always migrates forward.
- Project save always writes version 2 after migration.
- Export receives the migrated timeline document only.

### 6.3) Legacy fallback

If a project has no timeline, the engine/editor should still synthesize a single clip from the recording duration, just as today.

---

## 7) Canonical Timeline Compiler

The editor and export path should both compile timeline items into program-time spans.

### 7.1) Compiler outputs

The compiler should emit:

- `CompiledTimelineClip[]` for playback/export remapping
- `CompiledTimelineGap[]` for UI rendering
- total program duration

Example shape:

```ts
type CompiledTimelineClip = {
  itemId: string;
  index: number;
  sourceAssetId: "recording";
  sourceStartSeconds: number;
  sourceEndSeconds: number;
  programStartSeconds: number;
  programEndSeconds: number;
  durationSeconds: number;
};

type CompiledTimelineGap = {
  itemId: string;
  index: number;
  durationSeconds: number;
  programStartSeconds: number;
  programEndSeconds: number;
};
```

### 7.2) Playback rule

- Playback skips gaps.
- When the playhead enters a gap during preview playback, the transport advances visually through the gap, but the media element remains parked until the next clip boundary.
- The media element continues to be the authority for clip playback in `Edit`.

### 7.3) Export rule

- Export must render gaps as silence/empty program time or compact them depending on the timeline structure.
- Export must not infer edits from trim-only state once version 2 timeline items exist.

---

## 8) Pure Edit Command Layer

All edit operations should live in a pure timeline command module. React components should dispatch commands, not perform timeline mutation inline.

Suggested module:

- `apps/desktop-electrobun/src/mainview/app/studio/domain/timelineCommands.ts`

### 8.1) Command API

```ts
type TimelineEditResult = {
  document: TimelineDocument;
  nextSelectedItemId?: string | null;
  nextPlayheadSeconds?: number | null;
};

function splitAtProgramTime(
  document: TimelineDocument,
  playheadSeconds: number,
  options: { snapToFrame: boolean; frameRate: number },
): TimelineEditResult;

function liftSelection(
  document: TimelineDocument,
  selection: { itemId: string },
): TimelineEditResult;

function deleteSelection(
  document: TimelineDocument,
  selection: { itemId: string },
  options: { ripple: boolean },
): TimelineEditResult;

function moveSelection(
  document: TimelineDocument,
  selection: { itemId: string },
  destination: { beforeItemId?: string; afterItemId?: string; programTime?: number },
  options: { ripple: boolean },
): TimelineEditResult;
```

### 8.2) Command properties

Commands must be:

- pure
- frame-snapped when requested
- invariant-preserving
- normalization-aware
- independently unit-testable

---

## 9) Operation Semantics

### 9.1) Split

Rules:

- valid only when playhead is strictly inside a clip
- no-op if playhead is on a clip edge
- no-op if playhead falls inside a gap
- produces two adjacent clips whose source ranges partition the original clip

Example:

```ts
[ clip(0, 10) ] @ 4.0
-> [ clip(0, 4), clip(4, 10) ]
```

### 9.2) Lift

Rules:

- replace the selected clip with a gap of equal duration
- preserve total program duration
- preserve neighboring clip timing

Example:

```ts
[ clipA(0, 4), clipB(4, 9), clipC(9, 12) ]
lift clipB
-> [ clipA(0, 4), gap(5), clipC(9, 12) ]
```

### 9.3) Delete

Rules:

- if `ripple = true`, remove the selected clip and compact the timeline
- if `ripple = false`, behave as lift

Example:

```ts
[ clipA, clipB, clipC ]
delete clipB with ripple
-> [ clipA, clipC ]
```

### 9.4) Move

Rules with `ripple = true`:

- remove the source clip
- close the source hole
- insert clip at destination
- shift downstream items to make space

Rules with `ripple = false`:

- leave a gap at the source position
- place the clip at the destination using overwrite/position semantics
- split a destination gap if needed
- if dropping onto a clip region, replace that region and preserve remaining material as neighboring items where possible

The non-ripple move rules should be implemented conservatively in v1:

- support dropping into a gap directly
- support dropping before/after an item boundary
- defer arbitrary partial overwrite inside another clip if it adds too much complexity

That constraint is acceptable for the first pass and should be documented in UI behavior.

---

## 10) Normalization Rules

After every edit, run timeline normalization.

Normalization should:

- remove zero-duration clips
- remove zero-duration gaps
- merge adjacent gaps
- ensure items remain ordered
- ensure all durations are finite and non-negative

Optional normalization:

- merge adjacent clips that are contiguous in both source and program time only when they were created by a reversible no-op transformation

Do not auto-merge clips aggressively in v1; preserving visible edit history is more useful than over-normalizing.

---

## 11) Selection and Playhead Rules

### 11.1) Selection

- Selecting a clip selects the timeline item, not lane-specific render artifacts.
- Video and audio lane views remain linked representations of the same underlying clip item.
- Inspector selection for a clip should carry the item id and compiled program-time range.

### 11.2) Playhead after edits

- `Split`: playhead remains at the cut point and selects the trailing clip.
- `Lift`: playhead moves to the start of the new gap and clears selection.
- `Delete` with ripple: playhead remains at the former start of the deleted clip.
- `Move`: playhead moves to the start of the moved clip at its destination.

These defaults make repeat edit actions faster and align with editor expectations.

---

## 12) UI Wiring

### 12.1) Timeline toolbar

The toolbar should keep its current shape:

- `Select`
- `Trim`
- `Blade`
- `Snap`
- `Ripple`

But the actions need real command dispatch behind them.

### 12.2) Blade interaction

When the active tool is `Blade`:

- pointer-down on a clip should split at the clicked program time
- clicking empty space or a gap should do nothing
- the action should respect snap mode

### 12.3) Clip actions

Add contextual clip actions to the inspector for selected timeline clips:

- `Split at Playhead`
- `Lift`
- `Delete`

Add drag-to-move from the timeline surface after the pure move command exists.

### 12.4) Keyboard shortcuts

Recommended first-pass shortcuts:

- `B`: Blade tool
- `Delete` / `Backspace`: delete selected clip using current ripple mode
- `Shift+Delete`: lift selected clip
- `Cmd/Ctrl+Shift+D` or similar explicit binding for split-at-playhead if needed

If the current shortcut map already has conflicts, prefer exposing split in the inspector/context menu first and adding a dedicated shortcut in the follow-up pass.

### 12.5) Gap rendering

The timeline surface should render gaps explicitly as empty program regions:

- subtle recessed fill
- non-primary contrast
- optional diagonal texture so creators understand the space is intentional

This makes lift and non-ripple behavior legible.

---

## 13) Store and Mutation Flow

### 13.1) Source of truth

Timeline editing should use project timeline state as the source of truth.

The editor controller should:

- load the timeline document from project data
- apply pure commands locally
- persist the updated timeline document through `project.save`

### 13.2) Mutation strategy

Suggested first pass:

- apply edit locally in controller state
- debounce or explicitly save on user action

Suggested practical repo-first approach:

- add a local editable timeline state in the studio controller
- hydrate from project load
- persist on explicit save and export

This avoids turning every blade/delete action into an engine round-trip and keeps timeline editing responsive.

---

## 14) Export Integration

The export engine already accepts `timeline`.

Implementation rule:

- export should consume the normalized version 2 timeline document
- trim-in/trim-out in `Deliver` should act on program time, after timeline edits

This means:

- edits define the program
- deliver trims define a final subrange of that edited program

Do not keep separate contradictory edit and export timeline interpretations.

---

## 15) Testing Plan

### 15.1) Unit tests

Add tests for:

- split inside clip
- split on clip edge
- split in gap
- lift clip
- delete clip with ripple off
- delete clip with ripple on
- move clip with ripple on
- move clip into gap with ripple off
- normalization of adjacent gaps
- playhead/selection result after each edit
- frame snapping correctness

Suggested location:

- `apps/desktop-electrobun/src/mainview/app/studio/domain/__tests__/timelineCommands.test.ts`

### 15.2) Protocol and migration tests

Add tests for:

- version 1 `segments` migration to version 2 `items`
- Swift project round-trip load/save with version 2 timeline
- export request schema accepting version 2 timeline

Suggested locations:

- `Tests/projectMigrationTests/`
- `apps/desktop-electrobun/tests/`
- `packages/engine` tests if needed

### 15.3) Playback tests

Add tests for:

- program-to-source remapping across gaps
- preview playhead behavior at clip boundaries around gaps
- export duration matching edited program duration

---

## 16) Implementation Sequence

Recommended order:

1. Add protocol/engine schema for timeline items + migration from version 1.
2. Add editor compiler support for clip and gap items.
3. Add pure timeline command module with unit tests.
4. Add inspector actions for split/lift/delete.
5. Add blade tool click-to-split.
6. Add real delete/lift behavior from keyboard shortcuts.
7. Add drag-to-move with ripple-aware insert behavior.
8. Update export/playback paths to consume normalized version 2 timelines everywhere.

This sequence gives useful editing depth early without blocking on drag-and-drop polish.

---

## 17) Open Decisions

These should be settled before implementation starts:

- Whether `Delete` should always follow ripple mode or always mean ripple delete.
- Which explicit shortcut should be used for `Lift`.
- Whether non-ripple move in v1 is limited to gap/boundary destinations.
- Whether selected clip actions live only in the inspector initially or also in a context menu.

Recommended answers:

- `Delete` follows ripple mode.
- `Shift+Delete` performs lift.
- Non-ripple move in v1 is limited to boundaries and gaps.
- Start with inspector actions, then add context menu if needed.

---

## 18) Summary

The key architectural move is simple:

- stop treating the timeline as "just contiguous source segments"
- start treating it as an ordered program made of clips and gaps

That change is the minimum viable foundation for real editor operations, real ripple behavior, and future per-segment polish controls.
