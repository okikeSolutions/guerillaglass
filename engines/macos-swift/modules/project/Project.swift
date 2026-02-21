import Foundation

/// Public value type exposed by the macOS engine module.
public struct Project: Codable, Identifiable, Equatable {
    public let id: UUID
    public var createdAt: Date
    public var autoZoom: AutoZoomSettings
    public var captureMetadata: CaptureMetadata?

    public init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        autoZoom: AutoZoomSettings = AutoZoomSettings(),
        captureMetadata: CaptureMetadata? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.autoZoom = autoZoom
        self.captureMetadata = captureMetadata
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case createdAt
        case autoZoom
        case captureMetadata
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        autoZoom = try container.decodeIfPresent(AutoZoomSettings.self, forKey: .autoZoom) ?? AutoZoomSettings()
        captureMetadata = try container.decodeIfPresent(CaptureMetadata.self, forKey: .captureMetadata)
    }
}
