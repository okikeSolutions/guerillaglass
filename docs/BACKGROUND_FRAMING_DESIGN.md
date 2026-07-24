# Background framing contract design

Status: approved contract for the Phase 2 `background-framing-contract` and `background-framing-renderer` slices.

## Goal

Place captured screen content on a deterministic background stage with padding, rounded corners, and a shadow. The model must persist in project packages, travel explicitly with export requests, remain resolution-independent, and preserve existing output for old projects.

## Version 1 model

Use one shared `BackgroundFramingSettings` object:

```ts
type BackgroundFramingSettings = {
  version: 1;
  enabled: boolean;
  backgroundColor: string;
  paddingFraction: number;
  cornerRadiusFraction: number;
  shadowStrength: number;
};
```

Contract constraints and defaults:

| Field                  | Constraint                                                              | Default   | Meaning                                                                            |
| ---------------------- | ----------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------- |
| `version`              | literal `1`                                                             | `1`       | Style-algorithm version for deterministic future evolution.                        |
| `enabled`              | boolean                                                                 | `false`   | Disabled preserves the pre-framing full-frame render.                              |
| `backgroundColor`      | uppercase or lowercase `#RRGGBB`; normalize to uppercase when persisted | `#18181B` | Opaque sRGB stage color. Alpha, gradients, and images are not part of v1.          |
| `paddingFraction`      | finite number, `0...0.25`                                               | `0.06`    | Inset on every side as a fraction of the shorter output dimension.                 |
| `cornerRadiusFraction` | finite number, `0...0.10`                                               | `0.025`   | Card corner radius as a fraction of the shorter fitted-card dimension.             |
| `shadowStrength`       | finite number, `0...1`                                                  | `0.35`    | Unitless input to the versioned renderer shadow formula. Zero disables the shadow. |

Do not store pixels: the same project must render consistently at different export resolutions and aspect ratios. Do not add per-clip framing in v1; these settings are project-global with an optional export override.

## Contract placement

Define the schema and runtime type in `packages/engine-contract/src/shared/valueObjects.ts`, then add:

- required `backgroundFraming` to `projectStateSchema`;
- optional `backgroundFraming` to `projectSavePayloadSchema`;
- optional `backgroundFraming` to `exportRunPayloadSchema`.

The required project-state field represents the resolved default. Save/export payload fields remain optional for wire compatibility with older clients.

## Persistence and migration

- Persist the object at the project root as `backgroundFraming`.
- Existing project versions and missing fields decode to the defaults above.
- Follow the existing project migration/versioning mechanism; add explicit fixtures for the previous current version and the new version.
- Reject non-finite/out-of-range values at the contract boundary. Native decoding of legacy project files may default a wholly absent object, but must not partially accept malformed present values.
- Saving should emit the complete normalized v1 object.

## Export precedence

Resolve settings in this order:

1. explicit `export.run` payload override;
2. active persisted project settings;
3. v1 defaults.

Desktop export should send the renderer/controller's complete resolved settings so unsaved inspector changes are deterministic. Older clients may omit the field and receive persisted/default behavior.

During the contract-only slice, native export may accept and retain the setting while `enabled: false` preserves old output. Enabling UI and rendering non-default settings belongs to the immediately following renderer slice; do not expose a control that claims to affect preview/export before that wiring lands.

## Version 1 renderer semantics

The renderer slice must implement the same geometry for preview and native export:

1. Fill the output with `backgroundColor`.
2. Compute `paddingPixels = paddingFraction * min(outputWidth, outputHeight)`.
3. Aspect-fit the source inside the output rectangle inset by `paddingPixels`; never crop in this slice.
4. Compute `cornerRadiusPixels = cornerRadiusFraction * min(cardWidth, cardHeight)` and clip the source card.
5. Derive the shadow from `shadowStrength` and style `version`:
   - opacity: `0.30 * shadowStrength`;
   - blur radius: `0.035 * min(outputWidth, outputHeight) * shadowStrength`;
   - x offset: `0`;
   - y offset: `0.012 * min(outputWidth, outputHeight) * shadowStrength`.
6. Apply timeline/camera transforms within the source card's content coordinate space, not to the background stage.

Exact rounding should use floating-point geometry until the final render API; tests may allow a one-pixel raster tolerance while asserting deterministic transform values.

## Explicit non-goals

- Gradient, image, blur, or transparent backgrounds.
- User-defined shadow offsets/colors.
- Per-clip or keyframed framing.
- Crop/reframe behavior.
- Vertical camera replanning.
- Motion blur.

Those require new versioned fields or later roadmap slices rather than overloading v1 values.

## Required contract-slice coverage

- Effect Schema valid/default-shaped encode/decode tests and every numeric boundary.
- Invalid color, NaN/infinity, negative, and over-maximum rejection.
- Generated OpenAPI and Swift/Rust binding determinism.
- Swift project migration and save/open round trip.
- Rust foundation project save/open parity.
- Export precedence tests, even before visual rendering is enabled.
- Desktop payload propagation tests without exposing incomplete controls.
