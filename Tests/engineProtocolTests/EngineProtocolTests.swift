import EngineProtocol
import Testing

struct EngineProtocolTests {
    @Test
    func decodesAndEncodesRoundTrip() throws {
        let line = #"{"jsonrpc":"2.0","id":1,"method":"system.ping","params":{}}"#

        let request = try EngineLineCodec.decodeRequest(from: line)
        #expect(request.method == "system.ping")

        let response = EngineResponse.success(
            id: request.id,
            result: .object([
                "app": .string("guerillaglass")
            ])
        )

        let encoded = try EngineLineCodec.encodeResponse(response)
        #expect(encoded.contains("\"jsonrpc\":\"2.0\""))
        #expect(encoded.contains("\"result\""))
    }

    @Test
    func failsOnInvalidJSON() {
        #expect(throws: Error.self) {
            _ = try EngineLineCodec.decodeRequest(from: "not-json")
        }
    }
}
