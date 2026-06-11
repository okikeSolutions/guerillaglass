import EngineProtocol
import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

actor CallFlag {
    private var value = false
    func set() {
        value = true
    }

    func get() -> Bool {
        value
    }
}

func goldenFixtureData(_ name: String) throws -> Data {
    var url = URL(fileURLWithPath: #filePath)
    for _ in 0 ..< 5 {
        url.deleteLastPathComponent()
    }
    url.appendPathComponent("docs/fixtures/engine-contract-v2/golden/\(name)")
    return try Data(contentsOf: url)
}

final class EngineProtocolTests: XCTestCase {
    func testGeneratedTypesDecodeAndEncodeCaptureStartDisplayPayload() throws {
        let data = try goldenFixtureData("capture-start-display.request.json")
        let payload = try JSONDecoder().decode(Components.Schemas.CaptureStartDisplayPayload.self, from: data)

        XCTAssertEqual(payload.displayId?.value1, 1)
        XCTAssertEqual(payload.enableMic, true)
        XCTAssertEqual(payload.enablePreview, true)
        XCTAssertEqual(payload.captureFps, 30)

        let encoded = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        XCTAssertEqual(object["displayId"] as? Double, 1)
        XCTAssertEqual(object["enableMic"] as? Bool, true)
        XCTAssertNil(object["missingOptional"])
    }

    func testGeneratedTypesDecodeAndEncodeCaptureStatusResponseFixture() throws {
        let data = try goldenFixtureData("capture-status.response.json")
        let status = try JSONDecoder().decode(Components.Schemas.CaptureStatusResult.self, from: data)
        XCTAssertEqual(status.captureSessionId?.value1, "capture-session-1")
        XCTAssertEqual(status.telemetry.achievedFps?.value1, 30)

        let encoded = try JSONEncoder().encode(status)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        XCTAssertEqual(object["isRunning"] as? Bool, true)
        XCTAssertNil(object["recordingURL"])
    }

    func testGeneratedTypesDecodeUnauthorizedErrorFixture() throws {
        let data = try goldenFixtureData("engine-unauthorized.response.json")
        let error = try JSONDecoder().decode(Components.Schemas.EngineUnauthorizedError.self, from: data)
        XCTAssertEqual(error.code.value1, .permission_denied)
    }

    func testBearerAuthMiddlewareRejectsMissingToken() async throws {
        let middleware = EngineBearerAuthMiddleware(token: "test-token")
        let request = HTTPRequest(method: .get, scheme: nil, authority: "127.0.0.1", path: "/v1/system/ping")
        let nextCalled = CallFlag()

        let (response, body) = try await middleware.intercept(
            request,
            body: nil,
            metadata: .init(),
            operationID: "system.systemPing",
            next: { _, _, _ in
                await nextCalled.set()
                return (HTTPResponse(status: .ok), nil)
            }
        )

        let wasCalled = await nextCalled.get()
        XCTAssertFalse(wasCalled)
        XCTAssertEqual(response.status, .unauthorized)
        XCTAssertEqual(response.headerFields[.contentType], "application/json; charset=utf-8")
        let responseBody = try XCTUnwrap(body)
        let bytes = try await Array(collecting: responseBody, upTo: 1024)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any])
        XCTAssertEqual(object["code"] as? String, "permission_denied")
    }

    func testBearerAuthMiddlewareAllowsValidToken() async throws {
        let middleware = EngineBearerAuthMiddleware(token: "test-token")
        var fields = HTTPFields()
        fields[.authorization] = "Bearer test-token"
        let request = HTTPRequest(method: .get, scheme: nil, authority: "127.0.0.1", path: "/v1/system/ping", headerFields: fields)
        let nextCalled = CallFlag()

        let (response, body) = try await middleware.intercept(
            request,
            body: nil,
            metadata: .init(),
            operationID: "system.systemPing",
            next: { _, _, _ in
                await nextCalled.set()
                return (HTTPResponse(status: .ok), HTTPBody("ok"))
            }
        )

        let wasCalled = await nextCalled.get()
        XCTAssertTrue(wasCalled)
        XCTAssertEqual(response.status, .ok)
        XCTAssertNotNil(body)
    }

    func testBodyLimitMiddlewareRejectsKnownOversizedBody() async throws {
        let middleware = EngineBodyLimitMiddleware(maxBytes: 4)
        let request = HTTPRequest(method: .post, scheme: nil, authority: "127.0.0.1", path: "/v1/capture/start-display")
        let body = HTTPBody("oversized")
        let nextCalled = CallFlag()

        let (response, responseBody) = try await middleware.intercept(
            request,
            body: body,
            metadata: .init(),
            operationID: "capture.captureStartDisplay",
            next: { _, _, _ in
                await nextCalled.set()
                return (HTTPResponse(status: .ok), nil)
            }
        )

        let wasCalled = await nextCalled.get()
        XCTAssertFalse(wasCalled)
        XCTAssertEqual(response.status, .contentTooLarge)
        let bytes = try await Array(collecting: XCTUnwrap(responseBody), upTo: 1024)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any])
        XCTAssertEqual(object["code"] as? String, "bad_request")
    }

    func testGeneratedServerRegisterHandlersDispatchesAndEncodesPing() async throws {
        let transport = TestServerTransport()
        try TestEngineAPI().registerHandlers(on: transport, middlewares: [EngineBearerAuthMiddleware(token: "test-token")])
        var headers = HTTPFields()
        headers[.authorization] = "Bearer test-token"

        let (response, body) = try await transport.respond(method: .get, path: "/v1/system/ping", headers: headers)

        XCTAssertEqual(response.status, .ok)
        let bytes = try await Array(collecting: XCTUnwrap(body), upTo: 2048)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any])
        XCTAssertEqual(object["app"] as? String, "guerillaglass")
        XCTAssertEqual(object["protocolVersion"] as? String, "2")
    }

    func testGeneratedServerRegisterHandlersDispatchesJsonBodyAndEncodesSuccess() async throws {
        let transport = TestServerTransport()
        try TestEngineAPI().registerHandlers(on: transport, middlewares: [EngineBearerAuthMiddleware(token: "test-token")])
        var headers = HTTPFields()
        headers[.authorization] = "Bearer test-token"
        headers[.contentType] = "application/json"
        let body = try HTTPBody(goldenFixtureData("capture-start-display.request.json"))

        let (response, responseBody) = try await transport.respond(method: .post, path: "/v1/capture/start-display", headers: headers, body: body)

        XCTAssertEqual(response.status, .ok)
        let bytes = try await Array(collecting: XCTUnwrap(responseBody), upTo: 4096)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any])
        XCTAssertEqual(object["isRunning"] as? Bool, true)
        XCTAssertEqual(object["captureSessionId"] as? String, "capture-session-1")
        XCTAssertNil(object["recordingURL"])
    }

    func testGeneratedServerRegisterHandlersEncodesDeclaredBadRequest() async throws {
        let transport = TestServerTransport()
        try TestEngineAPI().registerHandlers(on: transport, middlewares: [EngineBearerAuthMiddleware(token: "test-token")])
        var headers = HTTPFields()
        headers[.authorization] = "Bearer test-token"
        headers[.contentType] = "application/json"
        let body = HTTPBody(#"{"displayId":400,"enableMic":true,"enablePreview":true,"captureFps":30}"#)

        let (response, responseBody) = try await transport.respond(method: .post, path: "/v1/capture/start-display", headers: headers, body: body)

        XCTAssertEqual(response.status, .badRequest)
        let bytes = try await Array(collecting: XCTUnwrap(responseBody), upTo: 2048)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: Data(bytes)) as? [String: Any])
        XCTAssertEqual(object["code"] as? String, "invalid_request")
        XCTAssertEqual(object["message"] as? String, "Invalid display.")
    }

    func testGeneratedServerTransportReportsUnsupportedRouteAndMethod() async throws {
        let transport = TestServerTransport()
        try TestEngineAPI().registerHandlers(on: transport)

        let wrongMethod = try await transport.respond(method: .post, path: "/v1/system/ping")
        XCTAssertEqual(wrongMethod.0.status, .methodNotAllowed)

        let wrongRoute = try await transport.respond(method: .get, path: "/v1/does-not-exist")
        XCTAssertEqual(wrongRoute.0.status, .notFound)
    }
}

struct UnimplementedOperation: Error {}

extension APIProtocol {
    func system_period_systemPing(_: Operations.system_period_systemPing.Input) async throws -> Operations.system_period_systemPing.Output {
        throw UnimplementedOperation()
    }

    func system_period_engineCapabilities(_: Operations.system_period_engineCapabilities.Input) async throws -> Operations.system_period_engineCapabilities.Output {
        throw UnimplementedOperation()
    }

    func agent_period_agentPreflight(_: Operations.agent_period_agentPreflight.Input) async throws -> Operations.agent_period_agentPreflight.Output {
        throw UnimplementedOperation()
    }

    func agent_period_agentRun(_: Operations.agent_period_agentRun.Input) async throws -> Operations.agent_period_agentRun.Output {
        throw UnimplementedOperation()
    }

    func agent_period_agentStatus(_: Operations.agent_period_agentStatus.Input) async throws -> Operations.agent_period_agentStatus.Output {
        throw UnimplementedOperation()
    }

    func agent_period_agentApply(_: Operations.agent_period_agentApply.Input) async throws -> Operations.agent_period_agentApply.Output {
        throw UnimplementedOperation()
    }

    func permissions_period_permissionsGet(_: Operations.permissions_period_permissionsGet.Input) async throws -> Operations.permissions_period_permissionsGet.Output {
        throw UnimplementedOperation()
    }

    func permissions_period_permissionsRequestScreenRecording(
        _: Operations.permissions_period_permissionsRequestScreenRecording.Input
    ) async throws -> Operations.permissions_period_permissionsRequestScreenRecording.Output {
        throw UnimplementedOperation()
    }

    func permissions_period_permissionsRequestMicrophone(
        _: Operations.permissions_period_permissionsRequestMicrophone.Input
    ) async throws -> Operations.permissions_period_permissionsRequestMicrophone.Output {
        throw UnimplementedOperation()
    }

    func permissions_period_permissionsRequestInputMonitoring(
        _: Operations.permissions_period_permissionsRequestInputMonitoring.Input
    ) async throws -> Operations.permissions_period_permissionsRequestInputMonitoring.Output {
        throw UnimplementedOperation()
    }

    func permissions_period_permissionsOpenInputMonitoringSettings(
        _: Operations.permissions_period_permissionsOpenInputMonitoringSettings.Input
    ) async throws -> Operations.permissions_period_permissionsOpenInputMonitoringSettings.Output {
        throw UnimplementedOperation()
    }

    func sources_period_sourcesList(_: Operations.sources_period_sourcesList.Input) async throws -> Operations.sources_period_sourcesList.Output {
        throw UnimplementedOperation()
    }

    func capture_period_captureStartDisplay(_: Operations.capture_period_captureStartDisplay.Input) async throws -> Operations.capture_period_captureStartDisplay.Output {
        throw UnimplementedOperation()
    }

    func capture_period_captureStartCurrentWindow(_: Operations.capture_period_captureStartCurrentWindow.Input) async throws -> Operations.capture_period_captureStartCurrentWindow.Output {
        throw UnimplementedOperation()
    }

    func capture_period_captureStartWindow(_: Operations.capture_period_captureStartWindow.Input) async throws -> Operations.capture_period_captureStartWindow.Output {
        throw UnimplementedOperation()
    }

    func capture_period_captureStop(_: Operations.capture_period_captureStop.Input) async throws -> Operations.capture_period_captureStop.Output {
        throw UnimplementedOperation()
    }

    func capture_period_captureStatus(_: Operations.capture_period_captureStatus.Input) async throws -> Operations.capture_period_captureStatus.Output {
        throw UnimplementedOperation()
    }

    func capture_period_capturePreviewFrame(_: Operations.capture_period_capturePreviewFrame.Input) async throws -> Operations.capture_period_capturePreviewFrame.Output {
        throw UnimplementedOperation()
    }

    func recording_period_recordingStart(_: Operations.recording_period_recordingStart.Input) async throws -> Operations.recording_period_recordingStart.Output {
        throw UnimplementedOperation()
    }

    func recording_period_recordingStop(_: Operations.recording_period_recordingStop.Input) async throws -> Operations.recording_period_recordingStop.Output {
        throw UnimplementedOperation()
    }

    func export_period_exportInfo(_: Operations.export_period_exportInfo.Input) async throws -> Operations.export_period_exportInfo.Output {
        throw UnimplementedOperation()
    }

    func export_period_exportRun(_: Operations.export_period_exportRun.Input) async throws -> Operations.export_period_exportRun.Output {
        throw UnimplementedOperation()
    }

    func export_period_exportRunCutPlan(_: Operations.export_period_exportRunCutPlan.Input) async throws -> Operations.export_period_exportRunCutPlan.Output {
        throw UnimplementedOperation()
    }

    func export_period_exportGet(_: Operations.export_period_exportGet.Input) async throws -> Operations.export_period_exportGet.Output {
        throw UnimplementedOperation()
    }

    func project_period_projectCurrent(_: Operations.project_period_projectCurrent.Input) async throws -> Operations.project_period_projectCurrent.Output {
        throw UnimplementedOperation()
    }

    func project_period_projectOpen(_: Operations.project_period_projectOpen.Input) async throws -> Operations.project_period_projectOpen.Output {
        throw UnimplementedOperation()
    }

    func project_period_projectSave(_: Operations.project_period_projectSave.Input) async throws -> Operations.project_period_projectSave.Output {
        throw UnimplementedOperation()
    }

    func project_period_projectRecents(_: Operations.project_period_projectRecents.Input) async throws -> Operations.project_period_projectRecents.Output {
        throw UnimplementedOperation()
    }
}

typealias TestHandler = @Sendable (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?)

final class TestServerTransport: ServerTransport {
    private var handlers: [String: TestHandler] = [:]
    private var paths: Set<String> = []

    func register(
        _ handler: @Sendable @escaping (HTTPRequest, HTTPBody?, ServerRequestMetadata) async throws -> (HTTPResponse, HTTPBody?),
        method: HTTPRequest.Method,
        path: String
    ) throws {
        handlers["\(method.rawValue) \(path)"] = handler
        paths.insert(path)
    }

    func respond(method: HTTPRequest.Method, path: String, headers: HTTPFields = [:], body: HTTPBody? = nil) async throws -> (HTTPResponse, HTTPBody?) {
        guard let handler = handlers["\(method.rawValue) \(path)"] else {
            if paths.contains(path) { return (HTTPResponse(status: .methodNotAllowed), nil) }
            return (HTTPResponse(status: .notFound), nil)
        }
        let request = HTTPRequest(method: method, scheme: nil, authority: "127.0.0.1", path: path, headerFields: headers)
        return try await handler(request, body, .init())
    }
}

struct TestEngineAPI: APIProtocol {
    func system_period_systemPing(_: Operations.system_period_systemPing.Input) async throws -> Operations.system_period_systemPing.Output {
        .ok(.init(body: .json(.init(
            app: .init(value1: "guerillaglass"),
            engineVersion: .init(value1: "0.0.0-test"),
            protocolVersion: .init(value1: "2"),
            platform: .init(value1: "test")
        ))))
    }

    func capture_period_captureStartDisplay(_ input: Operations.capture_period_captureStartDisplay.Input) async throws -> Operations.capture_period_captureStartDisplay.Output {
        let payload: Components.Schemas.CaptureStartDisplayPayload = switch input.body {
        case let .json(body): body
        }
        if payload.displayId?.value1 == 400 {
            return .badRequest(.init(body: .json(.init(
                code: .invalid_request,
                message: .init(value1: "Invalid display.")
            ))))
        }
        return .ok(.init(body: .json(.init(
            isRunning: true,
            isRecording: false,
            captureSessionId: .init(value1: "capture-session-1"),
            recordingDurationSeconds: .init(value1: 0),
            telemetry: .init(achievedFps: .init(value1: 30))
        ))))
    }
}
