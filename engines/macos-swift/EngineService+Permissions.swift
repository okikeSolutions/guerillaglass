import AVFoundation
import CoreGraphics
import EngineProtocol
import Foundation

extension EngineService {
    func permissions_period_permissionsGet(
        _: Operations.permissions_period_permissionsGet.Input
    ) async throws -> Operations.permissions_period_permissionsGet.Output {
        let inputMonitoring: Components.Schemas.PermissionsResult.inputMonitoringPayload = switch inputPermissionManager.status() {
        case .authorized: .granted
        case .denied: .denied
        case .notDetermined: .unknown
        }
        return .ok(.init(body: .json(.init(
            screenRecordingGranted: CGPreflightScreenCaptureAccess(),
            microphoneGranted: AVCaptureDevice.authorizationStatus(for: .audio) == .authorized,
            inputMonitoring: inputMonitoring
        ))))
    }

    func permissions_period_permissionsRequestScreenRecording(
        _: Operations.permissions_period_permissionsRequestScreenRecording.Input
    ) async throws -> Operations.permissions_period_permissionsRequestScreenRecording.Output {
        let granted = await MainActor.run { CGRequestScreenCaptureAccess() }
        return .ok(.init(body: .json(actionResult(granted))))
    }

    func permissions_period_permissionsRequestMicrophone(
        _: Operations.permissions_period_permissionsRequestMicrophone.Input
    ) async throws -> Operations.permissions_period_permissionsRequestMicrophone.Output {
        let granted = await AVCaptureDevice.requestAccess(for: .audio)
        return .ok(.init(body: .json(actionResult(granted))))
    }

    func permissions_period_permissionsRequestInputMonitoring(
        _: Operations.permissions_period_permissionsRequestInputMonitoring.Input
    ) async throws -> Operations.permissions_period_permissionsRequestInputMonitoring.Output {
        let granted = inputPermissionManager.requestAccess() == .authorized
        return .ok(.init(body: .json(actionResult(granted))))
    }

    func permissions_period_permissionsOpenInputMonitoringSettings(
        _: Operations.permissions_period_permissionsOpenInputMonitoringSettings.Input
    ) async throws -> Operations.permissions_period_permissionsOpenInputMonitoringSettings.Output {
        .ok(.init(body: .json(actionResult(inputPermissionManager.openInputMonitoringSettings()))))
    }
}
