import AppKit
import CoreGraphics
import Foundation

/// Refresh-rate and capture FPS capability helpers for ScreenCaptureKit sources.
public enum CaptureSourceCapability {
    static let minimumHighRefreshRateHz = 118.0
    static let maximumHighFrameRateEffectivePixels = 2_100_000.0

    struct DisplayCandidate {
        let displayID: CGDirectDisplayID
        let frame: CGRect
        let refreshHz: Double?
        let pixelScale: Double
    }

    public static func supportedFrameRates(
        refreshHz: Double?,
        width: Double? = nil,
        height: Double? = nil,
        pixelScale: Double? = nil
    ) -> [Int] {
        if highFrameRateSupported(
            refreshHz: refreshHz,
            width: width,
            height: height,
            pixelScale: pixelScale
        ) {
            return [24, 30, 60, 120]
        }
        return [24, 30, 60]
    }

    public static func validate(
        frameRate: Int,
        refreshHz: Double?,
        width: Double? = nil,
        height: Double? = nil,
        pixelScale: Double? = nil
    ) throws {
        let supportedRates = supportedFrameRates(
            refreshHz: refreshHz,
            width: width,
            height: height,
            pixelScale: pixelScale
        )
        guard supportedRates.contains(frameRate) else {
            throw CaptureError.unsupportedCaptureFrameRate(
                requested: frameRate,
                supported: supportedRates,
                refreshHz: refreshHz
            )
        }
    }

    public static func refreshRate(for displayID: CGDirectDisplayID) -> Double? {
        if let maximumFramesPerSecond = maximumFramesPerSecond(for: displayID) {
            return maximumFramesPerSecond
        }

        guard let displayMode = CGDisplayCopyDisplayMode(displayID) else {
            return nil
        }
        let refreshRate = displayMode.refreshRate
        if refreshRate > 0 {
            return refreshRate
        }
        return nil
    }

    public static func refreshRate(forWindowFrame frame: CGRect) -> Double? {
        bestDisplayCandidate(for: frame, candidates: availableDisplayCandidates())?.refreshHz
    }

    public static func pixelScale(forWindowFrame frame: CGRect) -> Double? {
        bestDisplayCandidate(for: frame, candidates: availableDisplayCandidates())?.pixelScale
    }

    public static func refreshRate(forContentRect rect: CGRect) -> Double? {
        bestDisplayCandidate(for: rect, candidates: availableDisplayCandidates())?.refreshHz
    }

    public static func pixelScale(forContentRect rect: CGRect) -> Double? {
        bestDisplayCandidate(for: rect, candidates: availableDisplayCandidates())?.pixelScale
    }

    public static func effectiveNativePixelCount(
        width: Double,
        height: Double,
        pixelScale: Double?
    ) -> Double {
        let resolvedPixelScale = max(1, pixelScale ?? 1)
        return max(1, width) * max(1, height) * resolvedPixelScale * resolvedPixelScale
    }

    static func bestDisplayCandidate(
        for rect: CGRect,
        candidates: [DisplayCandidate]
    ) -> DisplayCandidate? {
        guard !rect.isEmpty else { return nil }

        return candidates.max { left, right in
            let leftArea = overlapArea(rect, left.frame)
            let rightArea = overlapArea(rect, right.frame)
            if leftArea != rightArea {
                return leftArea < rightArea
            }

            let leftRefresh = left.refreshHz ?? 0
            let rightRefresh = right.refreshHz ?? 0
            if leftRefresh != rightRefresh {
                return leftRefresh < rightRefresh
            }

            return left.displayID > right.displayID
        }
    }

    private static func availableDisplayCandidates() -> [DisplayCandidate] {
        NSScreen.screens.compactMap { screen in
            guard
                let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
            else {
                return nil
            }

            let displayID = CGDirectDisplayID(screenNumber.uint32Value)
            return DisplayCandidate(
                displayID: displayID,
                frame: screen.frame,
                refreshHz: refreshRate(for: displayID),
                pixelScale: Double(screen.backingScaleFactor)
            )
        }
    }

    private static func maximumFramesPerSecond(for displayID: CGDirectDisplayID) -> Double? {
        for screen in NSScreen.screens {
            guard
                let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber,
                CGDirectDisplayID(screenNumber.uint32Value) == displayID
            else {
                continue
            }

            let maximumFramesPerSecond = screen.maximumFramesPerSecond
            if maximumFramesPerSecond > 0 {
                return Double(maximumFramesPerSecond)
            }
        }
        return nil
    }

    private static func overlapArea(_ left: CGRect, _ right: CGRect) -> Double {
        let intersection = left.intersection(right)
        if intersection.isNull || intersection.isEmpty {
            return 0
        }
        return intersection.width * intersection.height
    }

    private static func highFrameRateSupported(
        refreshHz: Double?,
        width: Double?,
        height: Double?,
        pixelScale: Double?
    ) -> Bool {
        guard let refreshHz, refreshHz >= minimumHighRefreshRateHz else {
            return false
        }
        guard let width, let height else {
            return true
        }
        return effectiveNativePixelCount(width: width, height: height, pixelScale: pixelScale) <=
            maximumHighFrameRateEffectivePixels
    }
}
