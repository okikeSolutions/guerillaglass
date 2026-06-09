import HTTPTypes
import OpenAPIRuntime

/// Server middleware that rejects known-size request bodies above a configured byte limit.
public struct EngineBodyLimitMiddleware: ServerMiddleware {
    private let maxBytes: Int64

    /// Creates a request body limit middleware.
    public init(maxBytes: Int64) {
        self.maxBytes = maxBytes
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        metadata: ServerRequestMetadata,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        if case let .known(length) = body?.length, length > maxBytes {
            var response = HTTPResponse(status: .contentTooLarge)
            response.headerFields[.contentType] = "application/json; charset=utf-8"
            let payload = #"{"code":"bad_request","message":"Request body exceeds engine limit."}"#
            return (response, HTTPBody(payload))
        }
        return try await next(request, body, metadata)
    }
}
