# Contributing to guerillaglass

Thanks for your interest in contributing. This repository uses SwiftPM (no Xcode project). More detailed build and run steps will be added as the MVP stabilizes.

## Development
- macOS 13.0+
- Swift 5.10+

## Build
```
swift build
```

## Run (packaged .app)
```
Scripts/compile_and_run.sh
```

## Package only
```
Scripts/package_app.sh release
```

## Permissions
- Screen Recording is required to preview capture.
- Microphone access is required when mic capture is enabled.

## Test
```
swift test
```

## Style
- SwiftFormat and SwiftLint configurations live at repo root.
