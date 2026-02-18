// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "guerillaglass",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "guerillaglass-engine", targets: ["guerillaglass-engine"])
    ],
    targets: [
        .target(
            name: "EngineProtocol",
            dependencies: [],
            path: "engines/protocol-swift"
        ),
        .executableTarget(
            name: "guerillaglass-engine",
            dependencies: ["EngineProtocol", "Capture", "InputTracking", "Export", "Project"],
            path: "engines/macos-swift",
            exclude: ["modules"]
        ),
        .target(
            name: "Capture",
            dependencies: ["Export"],
            path: "engines/macos-swift/modules/capture"
        ),
        .target(
            name: "InputTracking",
            dependencies: [],
            path: "engines/macos-swift/modules/inputTracking"
        ),
        .target(
            name: "Project",
            dependencies: [],
            path: "engines/macos-swift/modules/project"
        ),
        .target(
            name: "Automation",
            dependencies: ["InputTracking"],
            path: "engines/macos-swift/modules/automation"
        ),
        .target(
            name: "Rendering",
            dependencies: ["Automation"],
            path: "engines/macos-swift/modules/rendering"
        ),
        .target(
            name: "Export",
            dependencies: ["Automation", "Rendering"],
            path: "engines/macos-swift/modules/export"
        ),
        .testTarget(
            name: "AutomationTests",
            dependencies: ["Automation", "InputTracking"],
            path: "Tests/automationTests"
        ),
        .testTarget(
            name: "ProjectMigrationTests",
            dependencies: ["Project"],
            path: "Tests/projectMigrationTests"
        ),
        .testTarget(
            name: "RenderingDeterminismTests",
            dependencies: ["Rendering"],
            path: "Tests/renderingDeterminismTests"
        ),
        .testTarget(
            name: "CaptureTests",
            dependencies: ["Capture"],
            path: "Tests/captureTests"
        ),
        .testTarget(
            name: "ExportTests",
            dependencies: ["Export"],
            path: "Tests/exportTests"
        ),
        .testTarget(
            name: "EngineProtocolTests",
            dependencies: ["EngineProtocol"],
            path: "Tests/engineProtocolTests"
        )
    ]
)
