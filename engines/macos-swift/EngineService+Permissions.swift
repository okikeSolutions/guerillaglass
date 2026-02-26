import AVFoundation
import CoreGraphics
import EngineProtocol
import Foundation

extension EngineService {
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

    func capabilitiesResponse(id: String) -> EngineResponse {
        .success(
            id: id,
            result: .object([
                "protocolVersion": .string("2"),
                "platform": .string("macOS"),
                "phase": .string("native"),
                "capture": .object([
                    "display": .bool(true),
                    "window": .bool(true),
                    "systemAudio": .bool(true),
                    "microphone": .bool(true)
                ]),
                "recording": .object([
                    "inputTracking": .bool(true)
                ]),
                "export": .object([
                    "presets": .bool(true),
                    "cutPlan": .bool(true)
                ]),
                "project": .object([
                    "openSave": .bool(true)
                ]),
                "agent": .object([
                    "preflight": .bool(true),
                    "run": .bool(true),
                    "status": .bool(true),
                    "apply": .bool(true),
                    "localOnly": .bool(true),
                    "runtimeBudgetMinutes": .number(10)
                ])
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
