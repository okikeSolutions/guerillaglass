# protocol-rust

Shared Rust protocol package for native engines.

## Scope

- Request envelope decoding (`id` + `method` + `params`)
- Response envelope encoding (`ok` success/error format)
- Canonical method enum (`EngineMethod`) including `engine.capabilities`
- Monotonic timing primitives (`CaptureClock`, `RunningDuration`)

## Test

```bash
cargo test --manifest-path engines/protocol-rust/Cargo.toml
```
