import AVFoundation
import Capture
import CoreGraphics
import EngineProtocol
import Export
import Foundation
import InputTracking
import Project
import ScreenCaptureKit

final class EngineService {
    private let captureEngine = CaptureEngine()
    private let exportPipeline = ExportPipeline()
    private let projectStore = ProjectStore()
    private let inputPermissionManager = InputPermissionManager()
    private let inputSession = InputEventSession()

    private var trackInputEventsWhileRecording = false
    private var currentProjectURL: URL?
    private var currentProjectDocument = ProjectDocument()
    private var currentEventsURL: URL?

    func handleLine(_ line: String) async -> EngineResponse {
        do {
            let request = try EngineLineCodec.decodeRequest(from: line)
            return await handle(request)
        } catch {
            return .failure(id: "unknown", code: "invalid_request", message: error.localizedDescription)
        }
    }

    private func handle(_ request: EngineRequest) async -> EngineResponse {
        switch request.method {
        case "system.ping":
            pingResponse(id: request.id)
        case "permissions.get":
            permissionsGet(id: request.id)
        case "permissions.requestScreenRecording":
            await permissionsRequestScreenRecording(id: request.id)
        case "permissions.requestMicrophone":
            await permissionsRequestMicrophone(id: request.id)
        case "permissions.requestInputMonitoring":
            permissionsRequestInputMonitoring(id: request.id)
        case "permissions.openInputMonitoringSettings":
            permissionsOpenInputMonitoringSettings(id: request.id)
        case "sources.list":
            await sourcesListResponse(id: request.id)
        case "capture.startDisplay":
            await startDisplayResponse(id: request.id, params: request.params)
        case "capture.startWindow":
            await startWindowResponse(id: request.id, params: request.params)
        case "capture.stop":
            await stopCaptureResponse(id: request.id)
        case "recording.start":
            await startRecordingResponse(id: request.id, params: request.params)
        case "recording.stop":
            await stopRecordingResponse(id: request.id)
        case "capture.status":
            captureStatusResponse(id: request.id)
        case "export.info":
            exportInfoResponse(id: request.id)
        case "export.run":
            await exportRunResponse(id: request.id, params: request.params)
        case "project.current":
            projectStateResponse(id: request.id)
        case "project.open":
            projectOpenResponse(id: request.id, params: request.params)
        case "project.save":
            projectSaveResponse(id: request.id, params: request.params)
        default:
            .failure(
                id: request.id,
                code: "unsupported_method",
                message: "Unsupported method: \(request.method)"
            )
        }
    }
}

private extension EngineService {
    func pingResponse(id: String) -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "app": .string("guerillaglass"),
                "engineVersion": .string("0.2.0"),
                "protocolVersion": .string("2"),
                "platform": .string("macOS")
            ])
        )
    }

    func permissionsGet(id: String) -> EngineResponse {
        let screenRecordingGranted = CGPreflightScreenCaptureAccess()
        let microphoneStatus = AVCaptureDevice.authorizationStatus(for: .audio)
        let microphoneGranted = microphoneStatus == .authorized

        let inputMonitoring: JSONValue = switch inputPermissionManager.status() {
        case .authorized:
            .string("authorized")
        case .denied:
            .string("denied")
        case .notDetermined:
            .string("notDetermined")
        }

        return .success(
            id: id,
            result: .object([
                "screenRecordingGranted": .bool(screenRecordingGranted),
                "microphoneGranted": .bool(microphoneGranted),
                "inputMonitoring": inputMonitoring
            ])
        )
    }

    func permissionsRequestScreenRecording(id: String) async -> EngineResponse {
        let granted = await MainActor.run {
            CGRequestScreenCaptureAccess()
        }
        return .success(id: id, result: .object(["success": .bool(granted)]))
    }

    func permissionsRequestMicrophone(id: String) async -> EngineResponse {
        let granted = await AVCaptureDevice.requestAccess(for: .audio)
        return .success(id: id, result: .object(["success": .bool(granted)]))
    }

    func permissionsRequestInputMonitoring(id: String) -> EngineResponse {
        let status = inputPermissionManager.requestAccess()
        let granted = status == .authorized
        return .success(id: id, result: .object(["success": .bool(granted)]))
    }

    func permissionsOpenInputMonitoringSettings(id: String) -> EngineResponse {
        let opened = inputPermissionManager.openInputMonitoringSettings()
        return .success(id: id, result: .object(["success": .bool(opened)]))
    }
}

private extension EngineService {
    func sourcesListResponse(id: String) async -> EngineResponse {
        do {
            let result = try await listSources()
            return .success(id: id, result: result)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func listSources() async throws -> JSONValue {
        let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true)

        let displays: [JSONValue] = content.displays.map { display in
            .object([
                "id": .number(Double(display.displayID)),
                "width": .number(Double(display.width)),
                "height": .number(Double(display.height))
            ])
        }

        let windows = filteredWindows(from: content.windows)
        let sorted = ShareableWindow.sorted(windows.map(ShareableWindow.init(window:)))
        let encodedWindows: [JSONValue] = sorted.map { window in
            .object([
                "id": .number(Double(window.id)),
                "title": .string(window.title),
                "appName": .string(window.appName),
                "width": .number(window.size.width),
                "height": .number(window.size.height),
                "isOnScreen": .bool(window.isOnScreen)
            ])
        }

        return .object([
            "displays": .array(displays),
            "windows": .array(encodedWindows)
        ])
    }

    func filteredWindows(from windows: [SCWindow]) -> [SCWindow] {
        windows.filter { window in
            guard window.isOnScreen else { return false }
            guard window.frame.width > 1, window.frame.height > 1 else { return false }
            guard let app = window.owningApplication else { return false }
            let bundleID = app.bundleIdentifier
            if bundleID == "com.apple.WindowServer" || bundleID == "com.apple.dock" {
                return false
            }
            return true
        }
    }
}

private extension EngineService {
    func startDisplayResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let enableMic = params["enableMic"]?.boolValue ?? false
        do {
            try await captureEngine.startDisplayCapture(enableMic: enableMic)
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func startWindowResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let windowID = params["windowId"]?.intValue else {
            return .failure(id: id, code: "invalid_params", message: "windowId is required")
        }
        let enableMic = params["enableMic"]?.boolValue ?? false

        do {
            try await captureEngine.startWindowCapture(windowID: CGWindowID(windowID), enableMic: enableMic)
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func stopCaptureResponse(id: String) async -> EngineResponse {
        await captureEngine.stopCapture()
        await stopInputTrackingIfNeeded()
        return captureStatusResponse(id: id)
    }

    func startRecordingResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        let shouldTrackInputEvents = params["trackInputEvents"]?.boolValue ?? false

        do {
            if !captureEngine.isRunning {
                try await captureEngine.startDisplayCapture(enableMic: false)
            }
            try await captureEngine.startRecording()
            trackInputEventsWhileRecording = shouldTrackInputEvents
            if shouldTrackInputEvents {
                let referenceTime = CaptureClock().now().seconds
                await MainActor.run {
                    inputSession.start(referenceTime: referenceTime)
                }
            }
            if let descriptor = captureEngine.captureDescriptor {
                currentProjectDocument.project.captureMetadata = makeCaptureMetadata(from: descriptor)
            }
            return captureStatusResponse(id: id)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func stopRecordingResponse(id: String) async -> EngineResponse {
        await captureEngine.stopRecording()
        await stopInputTrackingIfNeeded()

        if let recordingURL = captureEngine.recordingURL {
            currentProjectDocument.recordingFileName = recordingURL.lastPathComponent
        }

        return captureStatusResponse(id: id)
    }

    func stopInputTrackingIfNeeded() async {
        guard trackInputEventsWhileRecording else { return }
        trackInputEventsWhileRecording = false

        let log = await MainActor.run {
            inputSession.stop()
        }
        guard !log.events.isEmpty else { return }

        let eventsURL = makeEventsURL()
        try? log.write(to: eventsURL)
        currentEventsURL = eventsURL
        currentProjectDocument.eventsFileName = ProjectFile.eventsJSON
    }

    func makeEventsURL() -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let timestamp = formatter.string(from: Date())
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-events-\(timestamp).json")
    }

    func captureStatusResponse(id: String) -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "isRunning": .bool(captureEngine.isRunning),
                "isRecording": .bool(captureEngine.isRecording),
                "recordingDurationSeconds": .number(captureEngine.recordingDuration),
                "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
                "lastError": captureEngine.lastError.map { .string($0) } ?? .null,
                "eventsURL": currentEventsURL.map { .string($0.path) } ?? .null
            ])
        )
    }
}

private extension EngineService {
    func exportInfoResponse(id: String) -> EngineResponse {
        let presets = Presets.all.map { preset in
            JSONValue.object([
                "id": .string(preset.id),
                "name": .string(preset.name),
                "width": .number(Double(preset.width)),
                "height": .number(Double(preset.height)),
                "fps": .number(Double(preset.fps)),
                "fileType": .string(fileTypeIdentifier(for: preset.fileType))
            ])
        }

        return .success(id: id, result: .object(["presets": .array(presets)]))
    }

    func exportRunResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let outputPath = params["outputURL"]?.stringValue else {
            return .failure(id: id, code: "invalid_params", message: "outputURL is required")
        }
        guard let presetID = params["presetId"]?.stringValue,
              let preset = preset(for: presetID)
        else {
            return .failure(id: id, code: "invalid_params", message: "Valid presetId is required")
        }

        guard let recordingURL = captureEngine.recordingURL else {
            return .failure(id: id, code: "invalid_params", message: "No recording available to export")
        }

        do {
            let duration = try await recordingDuration(for: recordingURL)
            let trimRange = TrimRangeCalculator.timeRange(
                start: params["trimStartSeconds"]?.doubleValue ?? 0,
                end: params["trimEndSeconds"]?.doubleValue ?? duration,
                duration: duration
            )

            let outputURL = URL(fileURLWithPath: outputPath)
            _ = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: trimRange,
                outputURL: outputURL,
                cameraPlan: nil
            )
            return .success(id: id, result: .object(["outputURL": .string(outputURL.path)]))
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func recordingDuration(for recordingURL: URL) async throws -> TimeInterval {
        if captureEngine.recordingDuration > 0 {
            return captureEngine.recordingDuration
        }
        let asset = AVAsset(url: recordingURL)
        let duration = try await asset.load(.duration)
        return duration.seconds
    }

    func preset(for id: String) -> ExportPreset? {
        Presets.all.first(where: { $0.id == id })
    }

    func fileTypeIdentifier(for fileType: AVFileType) -> String {
        switch fileType {
        case .mp4:
            "mp4"
        default:
            "mov"
        }
    }
}

private extension EngineService {
    func projectStateResponse(id: String) -> EngineResponse {
        .success(id: id, result: projectStateJSON())
    }

    func projectOpenResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        guard let projectPath = params["projectPath"]?.stringValue else {
            return .failure(id: id, code: "invalid_params", message: "projectPath is required")
        }

        do {
            let savedProject = try projectStore.loadProject(at: URL(fileURLWithPath: projectPath, isDirectory: true))
            currentProjectURL = savedProject.url
            currentProjectDocument = savedProject.document

            let recordingURL = projectStore.resolveRecordingURL(for: savedProject)
            if FileManager.default.fileExists(atPath: recordingURL.path) {
                captureEngine.loadRecording(from: recordingURL)
            } else {
                captureEngine.clearRecording()
            }

            if let eventsURL = projectStore.resolveEventsURL(for: savedProject),
               FileManager.default.fileExists(atPath: eventsURL.path)
            {
                currentEventsURL = eventsURL
            } else {
                currentEventsURL = nil
            }

            return .success(id: id, result: projectStateJSON())
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func projectSaveResponse(id: String, params: [String: JSONValue]) -> EngineResponse {
        if let autoZoom = parseAutoZoomSettings(from: params["autoZoom"]) {
            currentProjectDocument.project.autoZoom = autoZoom
        }
        if let descriptor = captureEngine.captureDescriptor {
            currentProjectDocument.project.captureMetadata = makeCaptureMetadata(from: descriptor)
        }

        let destinationURL: URL
        if let projectPath = params["projectPath"]?.stringValue {
            destinationURL = URL(fileURLWithPath: projectPath, isDirectory: true)
        } else if let currentProjectURL {
            destinationURL = currentProjectURL
        } else {
            return .failure(id: id, code: "invalid_params", message: "projectPath is required for first save")
        }

        guard let recordingURL = captureEngine.recordingURL else {
            return .failure(id: id, code: "invalid_params", message: "No recording available to save")
        }

        do {
            let recordingSource = sourceURLForWrite(
                sourceURL: recordingURL,
                destinationDirectory: destinationURL,
                expectedFileName: currentProjectDocument.recordingFileName
            )
            let eventsSource = sourceURLForWrite(
                sourceURL: currentEventsURL,
                destinationDirectory: destinationURL,
                expectedFileName: currentProjectDocument.eventsFileName ?? ProjectFile.eventsJSON
            )

            let writtenDocument = try projectStore.writeProject(
                document: currentProjectDocument,
                assets: ProjectStore.ProjectAssetURLs(
                    recordingURL: recordingSource,
                    eventsURL: eventsSource
                ),
                to: destinationURL
            )

            currentProjectURL = destinationURL
            currentProjectDocument = writtenDocument
            if let eventsSource {
                currentEventsURL = destinationURL.appendingPathComponent(eventsSource.lastPathComponent)
            }

            return .success(id: id, result: projectStateJSON())
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func projectStateJSON() -> JSONValue {
        let captureMetadata: JSONValue = if let metadata = currentProjectDocument.project.captureMetadata {
            .object([
                "source": .string(metadata.source.rawValue),
                "contentRect": .object([
                    "x": .number(metadata.contentRect.originX),
                    "y": .number(metadata.contentRect.originY),
                    "width": .number(metadata.contentRect.width),
                    "height": .number(metadata.contentRect.height)
                ]),
                "pixelScale": .number(metadata.pixelScale)
            ])
        } else {
            .null
        }

        return .object([
            "projectPath": currentProjectURL.map { .string($0.path) } ?? .null,
            "recordingURL": captureEngine.recordingURL.map { .string($0.path) } ?? .null,
            "eventsURL": currentEventsURL.map { .string($0.path) } ?? .null,
            "autoZoom": .object([
                "isEnabled": .bool(currentProjectDocument.project.autoZoom.isEnabled),
                "intensity": .number(currentProjectDocument.project.autoZoom.intensity),
                "minimumKeyframeInterval": .number(currentProjectDocument.project.autoZoom.minimumKeyframeInterval)
            ]),
            "captureMetadata": captureMetadata
        ])
    }

    func parseAutoZoomSettings(from value: JSONValue?) -> AutoZoomSettings? {
        guard let object = value?.objectValue else { return nil }
        guard let isEnabled = object["isEnabled"]?.boolValue,
              let intensity = object["intensity"]?.doubleValue,
              let minimumKeyframeInterval = object["minimumKeyframeInterval"]?.doubleValue
        else {
            return nil
        }

        return AutoZoomSettings(
            isEnabled: isEnabled,
            intensity: intensity,
            minimumKeyframeInterval: minimumKeyframeInterval
        ).clamped()
    }

    func sourceURLForWrite(sourceURL: URL?, destinationDirectory: URL, expectedFileName: String) -> URL? {
        guard let sourceURL else { return nil }
        let destinationURL = destinationDirectory.appendingPathComponent(expectedFileName)
        if sourceURL.standardizedFileURL == destinationURL.standardizedFileURL {
            return nil
        }
        return sourceURL
    }

    func makeCaptureMetadata(from descriptor: CaptureDescriptor) -> CaptureMetadata {
        let source: CaptureMetadata.Source = descriptor.source == .window ? .window : .display
        return CaptureMetadata(
            source: source,
            contentRect: CaptureRect(rect: descriptor.contentRect),
            pixelScale: Double(descriptor.pixelScale)
        )
    }
}

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
                if let line = try? EngineLineCodec.encodeResponse(fallback) {
                    FileHandle.standardOutput.write(Data((line + "\n").utf8))
                }
            }
        }
    }
}
