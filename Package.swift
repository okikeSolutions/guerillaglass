// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "guerillaglass",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "guerillaglass-engine", targets: ["guerillaglass-engine"]),
        .executable(name: "guerillaglass-code-signature-checker", targets: ["guerillaglass-code-signature-checker"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.12.2"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.3.0"),
        .package(url: "https://github.com/hummingbird-project/hummingbird.git", exact: "2.25.0"),
        .package(url: "https://github.com/swift-server/swift-openapi-hummingbird.git", exact: "2.0.1")
    ],
    targets: [
        .target(
            name: "EngineProtocol",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession")
            ],
            path: "engines/protocol-swift/Sources/EngineProtocol",
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
            ]
        ),
        .executableTarget(
            name: "guerillaglass-engine",
            dependencies: [
                "EngineProtocol",
                "Capture",
                "InputTracking",
                "Export",
                "Project",
                .product(name: "Hummingbird", package: "hummingbird"),
                .product(name: "OpenAPIHummingbird", package: "swift-openapi-hummingbird"),
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime")
            ],
            path: "engines/macos-swift",
            exclude: ["modules"]
        ),
        .executableTarget(
            name: "guerillaglass-code-signature-checker",
            dependencies: [],
            path: "engines/macos-code-signature-checker"
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
            dependencies: ["Capture", "InputTracking"],
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
