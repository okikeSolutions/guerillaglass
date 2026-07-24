import Foundation

/// Versioned project-global background stage and source-card framing settings.
public struct BackgroundFramingSettings: Codable, Equatable, Sendable {
    public enum ValidationError: Error, LocalizedError {
        case unsupportedVersion(Double)
        case invalidBackgroundColor(String)
        case outOfRange(field: String, value: Double, range: ClosedRange<Double>)

        public var errorDescription: String? {
            switch self {
            case let .unsupportedVersion(version):
                "Unsupported background framing version: \(version)."
            case let .invalidBackgroundColor(color):
                "Invalid background framing color: \(color)."
            case let .outOfRange(field, value, range):
                "Background framing \(field) \(value) is outside \(range.lowerBound)...\(range.upperBound)."
            }
        }
    }

    public static let currentVersion = 1
    public static let defaults = BackgroundFramingSettings()

    public let version: Int
    public var enabled: Bool
    public var backgroundColor: String
    public var paddingFraction: Double
    public var cornerRadiusFraction: Double
    public var shadowStrength: Double

    public init() {
        version = Self.currentVersion
        enabled = false
        backgroundColor = "#18181B"
        paddingFraction = 0.06
        cornerRadiusFraction = 0.025
        shadowStrength = 0.35
    }

    public init(
        version: Int,
        enabled: Bool,
        backgroundColor: String,
        paddingFraction: Double,
        cornerRadiusFraction: Double,
        shadowStrength: Double
    ) throws {
        try Self.validate(version: version)
        try Self.validateColor(backgroundColor)
        try Self.validate(paddingFraction, field: "paddingFraction", range: 0 ... 0.25)
        try Self.validate(cornerRadiusFraction, field: "cornerRadiusFraction", range: 0 ... 0.10)
        try Self.validate(shadowStrength, field: "shadowStrength", range: 0 ... 1)
        self.version = version
        self.enabled = enabled
        self.backgroundColor = backgroundColor.uppercased()
        self.paddingFraction = paddingFraction
        self.cornerRadiusFraction = cornerRadiusFraction
        self.shadowStrength = shadowStrength
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(
            version: container.decode(Int.self, forKey: .version),
            enabled: container.decode(Bool.self, forKey: .enabled),
            backgroundColor: container.decode(String.self, forKey: .backgroundColor),
            paddingFraction: container.decode(Double.self, forKey: .paddingFraction),
            cornerRadiusFraction: container.decode(Double.self, forKey: .cornerRadiusFraction),
            shadowStrength: container.decode(Double.self, forKey: .shadowStrength)
        )
    }

    /// Resolves export settings using explicit override, persisted project, then defaults precedence.
    public static func resolve(
        exportOverride: BackgroundFramingSettings?,
        persisted: BackgroundFramingSettings?
    ) -> BackgroundFramingSettings {
        exportOverride ?? persisted ?? .defaults
    }

    private static func validate(version: Int) throws {
        guard version == currentVersion else {
            throw ValidationError.unsupportedVersion(Double(version))
        }
    }

    private static func validateColor(_ color: String) throws {
        guard color.range(of: "^#[0-9A-Fa-f]{6}$", options: .regularExpression) != nil else {
            throw ValidationError.invalidBackgroundColor(color)
        }
    }

    private static func validate(_ value: Double, field: String, range: ClosedRange<Double>) throws {
        guard value.isFinite, range.contains(value) else {
            throw ValidationError.outOfRange(field: field, value: value, range: range)
        }
    }
}
