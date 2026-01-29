// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "guerillaglass",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "guerillaglass", targets: ["guerillaglass"])
    ],
    targets: [
        .executableTarget(
            name: "guerillaglass",
            dependencies: ["UI"],
            path: "app",
            exclude: [
                "Info.plist",
                "Entitlements.entitlements"
            ]
        ),
        .target(
            name: "UI",
            dependencies: ["Capture", "Project", "Rendering", "Automation"],
            path: "ui"
        ),
        .target(
            name: "Capture",
            dependencies: [],
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
            dependencies: [],
            path: "automation"
        ),
        .target(
            name: "Rendering",
            dependencies: [],
            path: "rendering"
        ),
        .target(
            name: "Export",
            dependencies: [],
            path: "export"
        ),
        .target(
            name: "Diagnostics",
            dependencies: [],
            path: "diagnostics"
        ),
        .testTarget(
            name: "AutomationTests",
            dependencies: ["Automation"],
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
        )
    ]
)
