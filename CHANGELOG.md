# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Smooth playback transport wiring with shared timeline timebase alignment for editor routes.
- Runtime capture FPS controls (`24/30/60`) with expanded capture telemetry surfaces.
- Display/window source picker flow that keeps selection active through capture start.
- Hardened loopback media playback transport with tokenized media paths and stricter access policy.
- Additional capture/source test coverage with enforced baseline thresholds.

### Changed
- Desktop app structure reorganized into clearer shell (`src/bun`) and renderer (`src/mainview`) boundaries.
- Studio shell split into focused modules, including extracted editor workspace layout hook.
- Media waveform/source loading migrated to query-driven flows for predictable state transitions.
- Engine protocol schema usage migrated away from deprecated Zod v4 APIs.
- Rust protocol method handling now generated from protocol manifest for stronger parity guarantees.
- Export pipeline modularized by splitting `AssetWriter` into lifecycle/video/audio units.
- Capture telemetry internals refactored into a dedicated store with unified frame-rate policy handling.
- Coverage gate thresholds and TypeScript path handling aligned for stricter CI parity.

### Fixed
- Desktop playback regressions in capture/edit routes.
- Start-capture flow now enforces Screen Recording permission before capture begins.
- Electrobun dialog RPC timeout behavior adjusted so long native dialogs are treated as recoverable workflow interruptions.
