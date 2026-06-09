import Foundation
import HTTPTypes
import OpenAPIRuntime

/// Server middleware that enforces the per-process local engine bearer token.
public struct EngineBearerAuthMiddleware: ServerMiddleware {
    private let expectedAuthorizationHeader: String

    /// Creates a bearer-auth middleware for the expected token value.
    public init(token: String) {
        self.expectedAuthorizationHeader = "Bearer \(token)"
    }

    public func intercept(
        _ request: HTTPRequest,
        body: HTTPBody?,
        metadata: ServerRequestMetadata,
        operationID: String,
        next: @Sendable (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?)
    ) async throws -> (HTTPResponse, HTTPBody?) {
        guard request.headerFields[.authorization] == expectedAuthorizationHeader else {
            var response = HTTPResponse(status: .unauthorized)
            response.headerFields[.contentType] = "application/json; charset=utf-8"
            let payload = #"{"code":"permission_denied","message":"Missing or invalid engine bearer token."}"#
            return (response, HTTPBody(payload))
        }
        return try await next(request, body, metadata)
    }
}
