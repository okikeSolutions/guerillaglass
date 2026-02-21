import CoreGraphics
import Foundation

/// Public enum exposed by the macOS engine module.
public enum InputEventType: String, Codable {
    case cursorMoved
    case mouseDown
    case mouseUp
}

/// Public enum exposed by the macOS engine module.
public enum MouseButton: String, Codable {
    case left
    case right
    case other
}

/// Public value type exposed by the macOS engine module.
public struct InputPoint: Codable, Equatable {
    public let xValue: Double
    public let yValue: Double

    public init(xCoordinate: Double, yCoordinate: Double) {
        xValue = xCoordinate
        yValue = yCoordinate
    }

    public init(_ point: CGPoint) {
        self.init(xCoordinate: point.x, yCoordinate: point.y)
    }

    public var cgPoint: CGPoint {
        CGPoint(x: xValue, y: yValue)
    }

    private enum CodingKeys: String, CodingKey {
        case xValue = "x"
        case yValue = "y"
    }
}

/// Public value type exposed by the macOS engine module.
public struct InputEvent: Codable, Equatable {
    public let type: InputEventType
    public let timestamp: TimeInterval
    public let position: InputPoint
    public let button: MouseButton?

    public init(
        type: InputEventType,
        timestamp: TimeInterval,
        position: CGPoint,
        button: MouseButton? = nil
    ) {
        self.type = type
        self.timestamp = timestamp
        self.position = InputPoint(position)
        self.button = button
    }
}
