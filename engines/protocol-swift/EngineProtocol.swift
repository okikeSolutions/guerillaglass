import Foundation

/// JSON-compatible value container used by engine request and response payloads.
public enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Int.self) {
            self = .number(Double(value))
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case let .string(value):
            try container.encode(value)
        case let .number(value):
            try container.encode(value)
        case let .bool(value):
            try container.encode(value)
        case let .object(value):
            try container.encode(value)
        case let .array(value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var boolValue: Bool? {
        if case let .bool(value) = self {
            return value
        }
        return nil
    }

    public var intValue: Int? {
        if case let .number(value) = self {
            return Int(exactly: value)
        }
        return nil
    }

    public var doubleValue: Double? {
        if case let .number(value) = self {
            return value
        }
        return nil
    }

    public var stringValue: String? {
        if case let .string(value) = self {
            return value
        }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case let .object(value) = self {
            return value
        }
        return nil
    }
}

/// Request envelope sent from the desktop shell to the native engine.
public struct EngineRequest: Codable, Equatable {
    public let type: String
    public let id: String
    public let method: String
    public let params: [String: JSONValue]

    public init(id: String, method: String, params: [String: JSONValue]) {
        type = "request"
        self.id = id
        self.method = method
        self.params = params
    }

    private enum CodingKeys: String, CodingKey {
        case type, id, method, params
    }

    public var methodKind: EngineMethod? {
        EngineMethod(method: method)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? "request"
        if let stringId = try? container.decode(String.self, forKey: .id) {
            id = stringId
        } else if let intId = try? container.decode(Int.self, forKey: .id) {
            id = String(intId)
        } else {
            id = try String(container.decode(Double.self, forKey: .id))
        }
        method = try container.decode(String.self, forKey: .method)
        params = try container.decodeIfPresent([String: JSONValue].self, forKey: .params) ?? [:]
    }
}

public struct EngineError: Codable, Equatable {
    public let code: String
    public let message: String
}

// swiftlint:disable identifier_name
/// Response envelope returned by the native engine using the stable Guerillaglass wire protocol.
public struct EngineResponse: Codable, Equatable {
    public let type: String
    public let id: String
    public let result: JSONValue?
    public let error: EngineError?

    public init(id: String, result: JSONValue?, error: EngineError?) {
        type = error == nil ? "response" : "error"
        self.id = id
        self.result = result
        self.error = error
    }

    public static func success(id: String, result: JSONValue) -> EngineResponse {
        EngineResponse(id: id, result: result, error: nil)
    }

    public static func failure(id: String, code: String, message: String) -> EngineResponse {
        EngineResponse(id: id, result: nil, error: EngineError(code: code, message: message))
    }
}

/// Streaming chunk envelope emitted by the stable Guerillaglass wire protocol.
public struct EngineChunkResponse: Codable, Equatable {
    public let type: String
    public let id: String
    public let values: [JSONValue]

    public init(id: String, values: [JSONValue]) {
        type = "chunk"
        self.id = id
        self.values = values
    }
}

// swiftlint:enable identifier_name

/// Errors thrown while decoding or encoding protocol lines.
public enum EngineProtocolError: Error {
    case invalidLine
}

/// Line-delimited JSON codec for engine request and response transport.
public enum EngineLineCodec {
    private static let decoder = JSONDecoder()
    private static let encoder = JSONEncoder()

    public static func decodeRequest(from line: String) throws -> EngineRequest {
        guard let data = line.data(using: .utf8) else {
            throw EngineProtocolError.invalidLine
        }
        return try decoder.decode(EngineRequest.self, from: data)
    }

    public static func encodeResponse(_ response: EngineResponse) throws -> String {
        let data = try encoder.encode(response)
        guard let line = String(data: data, encoding: .utf8) else {
            throw EngineProtocolError.invalidLine
        }
        return line
    }

    public static func encodeChunk(_ response: EngineChunkResponse) throws -> String {
        let data = try encoder.encode(response)
        guard let line = String(data: data, encoding: .utf8) else {
            throw EngineProtocolError.invalidLine
        }
        return line
    }
}
