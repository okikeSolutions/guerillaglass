import Foundation

public struct Project: Codable, Identifiable, Equatable {
    public let id: UUID
    public var createdAt: Date

    public init(id: UUID = UUID(), createdAt: Date = Date()) {
        self.id = id
        self.createdAt = createdAt
    }
}
