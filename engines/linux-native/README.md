# Linux Native Engine (Foundation)

This is the native Linux sidecar foundation for Guerillaglass protocol parity.

## Build

```bash
cd engines/linux-native
cargo build --release
```

Expected binary path:

- `engines/linux-native/bin/guerillaglass-engine-linux`

## Notes

- Protocol handlers are exposed through the Engine Contract v2 local HTTP/OpenAPI server.
- The process binds to `127.0.0.1:0`, requires `GG_ENGINE_TRANSPORT=http`, and enforces `Authorization: Bearer <GG_ENGINE_HTTP_AUTH_TOKEN>`.
- Generated DTOs, route dispatch, and response encoding come from `engines/protocol-rust`.
- Capture/audio/input internals are currently foundation-level and need Linux compositor/audio integration for production capture quality.
