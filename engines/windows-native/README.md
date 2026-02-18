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

- Protocol handlers are implemented for parity (`permissions`, `sources`, `capture`, `recording`, `export`, `project`).
- Capture/audio/input internals are currently foundation-level and need Windows API integration for production capture quality.
