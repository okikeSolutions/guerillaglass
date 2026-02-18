import Foundation

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

    public var stringValue: String? {
        if case let .string(value) = self {
            return value
        }
        return nil
    }
}

public struct EngineRequest: Codable, Equatable {
    public let id: String
    public let method: String
    public let params: [String: JSONValue]

    public init(id: String, method: String, params: [String: JSONValue]) {
        self.id = id
        self.method = method
        self.params = params
    }
}

public struct EngineError: Codable, Equatable {
    public let code: String
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
    }
}

// swiftlint:disable identifier_name
public struct EngineResponse: Codable, Equatable {
    public let id: String
    public let ok: Bool
    public let result: JSONValue?
    public let error: EngineError?

    public init(id: String, ok: Bool, result: JSONValue?, error: EngineError?) {
        self.id = id
        self.ok = ok
        self.result = result
        self.error = error
    }

    public static func success(id: String, result: JSONValue) -> EngineResponse {
        EngineResponse(id: id, ok: true, result: result, error: nil)
    }

    public static func failure(id: String, code: String, message: String) -> EngineResponse {
        EngineResponse(id: id, ok: false, result: nil, error: EngineError(code: code, message: message))
    }
}

// swiftlint:enable identifier_name

public enum EngineProtocolError: Error {
    case invalidLine
}

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
}
