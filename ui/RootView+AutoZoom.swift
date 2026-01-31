import Automation
import AVFoundation
import Capture
import CoreGraphics
import InputTracking
import Project
import Rendering
import SwiftUI

extension RootView {
    var autoZoomSettings: AutoZoomSettings {
        get { document.projectDocument.project.autoZoom }
        nonmutating set { document.projectDocument.project.autoZoom = newValue.clamped() }
    }

    var autoZoomEnabledBinding: Binding<Bool> {
        Binding(
            get: { autoZoomSettings.isEnabled },
            set: { newValue in
                var settings = autoZoomSettings
                settings.isEnabled = newValue
                autoZoomSettings = settings
            }
        )
    }

    var autoZoomIntensityBinding: Binding<Double> {
        Binding(
            get: { autoZoomSettings.intensity },
            set: { newValue in
                var settings = autoZoomSettings
                settings.intensity = newValue
                autoZoomSettings = settings
            }
        )
    }

    var autoZoomKeyframeIntervalBinding: Binding<Double> {
        Binding(
            get: { autoZoomSettings.minimumKeyframeInterval },
            set: { newValue in
                var settings = autoZoomSettings
                settings.minimumKeyframeInterval = newValue
                autoZoomSettings = settings
            }
        )
    }

    var autoZoomIntensityLabel: String {
        let percent = Int((autoZoomSettings.intensity * 100).rounded())
        return "\(percent)%"
    }

    var autoZoomKeyframeIntervalLabel: String {
        let milliseconds = Int((autoZoomSettings.minimumKeyframeInterval * 1000).rounded())
        return "\(milliseconds) ms"
    }

    @MainActor
    func refreshPreviewComposition(for url: URL?) {
        previewRefreshTask?.cancel()
        let assetURL = url
        previewRefreshTask = Task { [assetURL] in
            try? await Task.sleep(nanoseconds: 250_000_000)
            await applyCameraPlanPreview(for: assetURL)
        }
    }

    @MainActor
    func makeCameraPlan(for asset: AVAsset) async -> CameraPlan? {
        let settings = autoZoomSettings.clamped()
        guard settings.isEnabled else { return nil }

        guard let inputs = await makePlanInputs(for: asset, settings: settings) else { return nil }
        if let cache = cameraPlanCache, cache.key == inputs.key {
            return cache.plan
        }

        let constraints = constraints(for: settings)
        let plan = cameraPlanner.plan(
            events: inputs.events,
            sourceSize: inputs.sourceSize,
            duration: inputs.duration,
            constraints: constraints
        )

        cameraPlanCache = CameraPlanCache(key: inputs.key, plan: plan, composition: nil)
        return plan
    }

    @MainActor
    func syncCaptureMetadata() {
        guard let descriptor = captureEngine.captureDescriptor else {
            document.updateCaptureMetadata(nil)
            return
        }
        document.updateCaptureMetadata(CaptureMetadata(descriptor: descriptor))
    }
}

private extension RootView {
    @MainActor
    func applyCameraPlanPreview(for url: URL?) async {
        guard let url else {
            playbackModel.applyVideoComposition(nil)
            return
        }

        let asset = AVAsset(url: url)
        let settings = autoZoomSettings.clamped()
        guard settings.isEnabled else {
            playbackModel.applyVideoComposition(nil)
            return
        }

        guard let inputs = await makePlanInputs(for: asset, settings: settings) else {
            playbackModel.applyVideoComposition(nil)
            return
        }

        if let cache = cameraPlanCache, cache.key == inputs.key, let composition = cache.composition {
            guard playbackModel.currentURL == url else { return }
            playbackModel.applyVideoComposition(composition)
            return
        }

        let constraints = constraints(for: settings)
        let plan = cameraPlanner.plan(
            events: inputs.events,
            sourceSize: inputs.sourceSize,
            duration: inputs.duration,
            constraints: constraints
        )
        let composition = try? await previewRenderer.makeVideoComposition(asset: asset, plan: plan)

        cameraPlanCache = CameraPlanCache(key: inputs.key, plan: plan, composition: composition)
        guard playbackModel.currentURL == url else { return }
        playbackModel.applyVideoComposition(composition)
    }

    func loadInputEvents() -> [InputEvent] {
        guard let eventsURL = document.assets.eventsURL else { return [] }
        return (try? InputEventLog.load(from: eventsURL))?.events ?? []
    }

    func makePlanInputs(for asset: AVAsset, settings: AutoZoomSettings) async -> CameraPlanInputs? {
        let tracks = try? await asset.loadTracks(withMediaType: .video)
        guard let track = tracks?.first else { return nil }
        let duration = await (try? asset.load(.duration))?.seconds ?? 0
        let naturalSize = await (try? track.load(.naturalSize)) ?? .zero
        guard naturalSize.width > 0, naturalSize.height > 0 else { return nil }

        let events = mappedInputEvents(for: naturalSize)
        let key = AutoZoomPlanSupport.makeCacheKey(
            events: events,
            settings: settings,
            duration: duration,
            sourceSize: naturalSize
        )
        return CameraPlanInputs(events: events, sourceSize: naturalSize, duration: duration, key: key)
    }

    func mappedInputEvents(for sourceSize: CGSize) -> [InputEvent] {
        let events = loadInputEvents()
        guard let metadata = document.projectDocument.project.captureMetadata else { return events }
        return AutoZoomPlanSupport.mapEventsToCaptureSpace(events, metadata: metadata, sourceSize: sourceSize)
    }

    func constraints(for settings: AutoZoomSettings) -> ZoomConstraints {
        let intensity = max(0, min(settings.intensity, 1))
        var constraints = ZoomConstraints()
        constraints.minimumKeyframeInterval = settings.minimumKeyframeInterval
        let followSmoothing: CGFloat = 0.75
        constraints.maxPanSpeed *= followSmoothing
        constraints.maxPanAcceleration *= followSmoothing
        let maxZoomDelta = constraints.maxZoom - 1
        constraints.maxZoom = 1 + maxZoomDelta * CGFloat(intensity)
        let idleZoomDelta = constraints.idleZoom - 1
        constraints.idleZoom = 1 + idleZoomDelta * CGFloat(intensity)
        constraints.motionIntensity *= intensity
        constraints.dwellIntensity *= intensity
        constraints.clickIntensity *= intensity
        return constraints
    }
}

private struct CameraPlanInputs {
    let events: [InputEvent]
    let sourceSize: CGSize
    let duration: TimeInterval
    let key: CameraPlanCacheKey
}

private extension CaptureMetadata {
    init(descriptor: CaptureDescriptor) {
        let source: CaptureMetadata.Source = descriptor.source == .window ? .window : .display
        self.init(
            source: source,
            contentRect: CaptureRect(rect: descriptor.contentRect),
            pixelScale: Double(descriptor.pixelScale)
        )
    }
}
