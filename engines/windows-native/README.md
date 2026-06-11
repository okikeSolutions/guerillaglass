# Windows Native Engine (Foundation)

This is the native Windows sidecar foundation for Guerillaglass protocol parity.

## Build

```bash
cd engines/windows-native
cargo build --release
```

Expected binary path:

- `engines/windows-native/bin/guerillaglass-engine-windows.exe`

## Notes

- Protocol handlers are exposed through the Engine Contract v2 local HTTP/OpenAPI server.
- The process binds to `127.0.0.1:0`, requires `GG_ENGINE_TRANSPORT=http`, and enforces `Authorization: Bearer <GG_ENGINE_HTTP_AUTH_TOKEN>`.
- Generated DTOs, route dispatch, and response encoding come from `engines/protocol-rust`.
- Capture/audio/input internals are currently foundation-level and need Windows API integration for production capture quality.
