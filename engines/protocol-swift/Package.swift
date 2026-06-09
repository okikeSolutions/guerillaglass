// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "EngineProtocol",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "EngineProtocol", targets: ["EngineProtocol"])
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.12.2"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.3.0")
    ],
    targets: [
        .target(
            name: "EngineProtocol",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession")
            ],
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")
            ]
        )
    ]
)
