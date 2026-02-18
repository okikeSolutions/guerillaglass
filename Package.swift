// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "guerillaglass",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "guerillaglass", targets: ["guerillaglass"]),
        .executable(name: "guerillaglass-engine", targets: ["guerillaglass-engine"])
    ],
    targets: [
        .target(
            name: "EngineProtocol",
            dependencies: [],
            path: "engines/protocol-swift"
        ),
        .executableTarget(
            name: "guerillaglass",
            dependencies: ["UI"],
            path: "app",
            exclude: [
                "Info.plist",
                "Entitlements.entitlements"
            ],
            resources: [
                .process("Resources")
            ]
        ),
        .executableTarget(
            name: "guerillaglass-engine",
            dependencies: ["EngineProtocol", "Capture", "InputTracking"],
            path: "engines/macos-swift"
        ),
        .target(
            name: "UI",
            dependencies: ["Capture", "Project", "Rendering", "Automation", "Export", "InputTracking"],
            path: "ui"
        ),
        .target(
            name: "Capture",
            dependencies: ["Export"],
            path: "capture"
        ),
        .target(
            name: "InputTracking",
            dependencies: [],
            path: "inputTracking"
        ),
        .target(
            name: "Project",
            dependencies: [],
            path: "project"
        ),
        .target(
            name: "Automation",
            dependencies: ["InputTracking"],
            path: "automation"
        ),
        .target(
            name: "Rendering",
            dependencies: ["Automation"],
            path: "rendering"
        ),
        .target(
            name: "Export",
            dependencies: ["Automation", "Rendering"],
            path: "export"
        ),
        .target(
            name: "Diagnostics",
            dependencies: [],
            path: "diagnostics"
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
            name: "UITests",
            dependencies: ["UI", "InputTracking", "Project"],
            path: "Tests/uiTests"
        ),
        .testTarget(
            name: "EngineProtocolTests",
            dependencies: ["EngineProtocol"],
            path: "Tests/engineProtocolTests"
        )
    ]
)
