# protocol-rust

Shared Rust protocol package for native engines.

## Scope

- Stable Guerillaglass socket wire messages: request, response, error, chunk, ping, pong, interrupt
- Request envelope decoding (`id`, `method`, `params`, `authToken`)
- Response/error/chunk envelope encoding
- Canonical method enum (`EngineMethod`) including `engine.capabilities`
- Monotonic timing primitives (`CaptureClock`, `RunningDuration`)

Native engines use this stable wire contract. Effect RPC serialization remains TypeScript-internal in `packages/engine/src/client/wireProtocol.ts`.

## Test

```bash
cargo test --manifest-path engines/protocol-rust/Cargo.toml
```
