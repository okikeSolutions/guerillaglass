import EngineProtocol
import Testing

struct EngineProtocolTests {
    @Test
    func decodesAndEncodesRoundTrip() throws {
        let line = #"{"type":"request","id":"1","method":"system.ping","params":{}}"#

        let request = try EngineLineCodec.decodeRequest(from: line)
        #expect(request.method == "system.ping")
        #expect(request.methodKind == .systemPing)

        let response = EngineResponse.success(
            id: request.id,
            result: .object([
                "app": .string("guerillaglass")
            ])
        )

        let encoded = try EngineLineCodec.encodeResponse(response)
        #expect(encoded.contains("\"type\":\"response\""))
        #expect(encoded.contains("\"result\""))
    }

    @Test
    func encodesStreamChunk() throws {
        let encoded = try EngineLineCodec.encodeChunk(
            EngineChunkResponse(id: "stream-1", values: [.object(["ok": .bool(true)])])
        )
        #expect(encoded.contains("\"type\":\"chunk\""))
        #expect(encoded.contains("\"values\""))
    }

    @Test
    func failsOnInvalidJSON() {
        #expect(throws: Error.self) {
            _ = try EngineLineCodec.decodeRequest(from: "not-json")
        }
    }
}
