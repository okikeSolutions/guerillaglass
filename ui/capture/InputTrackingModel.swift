import Foundation
import InputTracking

@MainActor
final class InputTrackingModel: ObservableObject {
    @Published var isEnabled = true
    @Published private(set) var permissionStatus: InputMonitoringStatus
    @Published var showPermissionAlert = false
    @Published private(set) var lastEventsURL: URL?

    private let permissionManager: InputPermissionManager
    private let session: InputEventSession

    init(
        permissionManager: InputPermissionManager = InputPermissionManager(),
        session: InputEventSession = InputEventSession()
    ) {
        self.permissionManager = permissionManager
        self.session = session
        permissionStatus = permissionManager.status()
    }

    func refreshPermissionStatus() {
        permissionStatus = permissionManager.status()
    }

    func setEnabled(_ enabled: Bool) {
        if enabled {
            permissionStatus = permissionManager.requestAccess()
            if permissionStatus == .authorized {
                isEnabled = true
            } else {
                isEnabled = false
                showPermissionAlert = true
            }
        } else {
            isEnabled = false
        }
    }

    func openSystemSettings() {
        permissionManager.openInputMonitoringSettings()
    }

    func startIfPermitted(referenceTime: TimeInterval? = nil) {
        permissionStatus = permissionManager.status()
        guard isEnabled else { return }
        if permissionStatus == .notDetermined {
            permissionStatus = permissionManager.requestAccess()
        }
        guard permissionStatus == .authorized else {
            showPermissionAlert = true
            return
        }
        session.start(referenceTime: referenceTime)
    }

    func stopAndPersist() throws -> URL? {
        guard session.isRunning else { return nil }
        let log = session.stop()
        guard !log.events.isEmpty else { return nil }
        let url = makeEventsURL()
        try log.write(to: url)
        lastEventsURL = url
        return url
    }

    private func makeEventsURL() -> URL {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withDashSeparatorInDate, .withColonSeparatorInTime]
        let timestamp = formatter.string(from: Date())
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("guerillaglass-events-\(timestamp).json")
    }
}
