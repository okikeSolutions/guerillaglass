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

- Protocol handlers are implemented for parity (`permissions`, `sources`, `capture`, `recording`, `export`, `project`).
- Capture/audio/input internals are currently foundation-level and need Linux compositor/audio integration for production capture quality.
