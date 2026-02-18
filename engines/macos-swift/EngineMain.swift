import EngineProtocol
import Foundation

@main
struct GuerillaglassEngineMain {
    static func main() async {
        let service = EngineService()

        while let line = readLine() {
            let response = await service.handleLine(line)
            do {
                let encoded = try EngineLineCodec.encodeResponse(response)
                FileHandle.standardOutput.write(Data((encoded + "\n").utf8))
            } catch {
                let fallback = EngineResponse.failure(
                    id: response.id,
                    code: "runtime_error",
                    message: "Failed to encode response: \(error.localizedDescription)"
                )
                if let fallbackLine = try? EngineLineCodec.encodeResponse(fallback) {
                    FileHandle.standardOutput.write(Data((fallbackLine + "\n").utf8))
                }
            }
        }
    }
}
