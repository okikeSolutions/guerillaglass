import AVFoundation
import CoreImage
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// Immutable shell preview snapshot derived from the latest capture frame.
public struct CapturePreviewFrameSnapshot: Sendable {
    public let frameId: Int
    public let bytesBase64: String

    public init(
        frameId: Int,
        bytesBase64: String
    ) {
        self.frameId = frameId
        self.bytesBase64 = bytesBase64
    }
}

extension CaptureEngine {
    /// Returns the latest cached live preview frame for shell rendering.
    public func latestPreviewFrame() -> CapturePreviewFrameSnapshot? {
        livePreviewStore.latestFrame()
    }

    func cachePreviewSample(_ sampleBuffer: CMSampleBuffer) {
        livePreviewStore.enqueue(sampleBuffer)
    }

    func clearPreviewFrame() {
        livePreviewStore.reset()
    }
}

final class CapturePreviewStore {
    private let queue = DispatchQueue(label: "gg.capture.preview")
    private let stateLock = NSLock()
    private let context = CIContext()
    private let maxLongEdge: CGFloat = 960
    private let minimumFrameIntervalSeconds = 1.0 / 8.0
    private let jpegCompressionQuality: Double = 0.6

    private var latestFrameSnapshot: CapturePreviewFrameSnapshot?
    private var pendingSampleBuffer: CMSampleBuffer?
    private var isEncoding = false
    private var lastScheduledPresentationSeconds = -Double.infinity
    private var nextFrameId = 1
    private var generation = 0

    func latestFrame() -> CapturePreviewFrameSnapshot? {
        stateLock.lock()
        defer {
            stateLock.unlock()
        }
        return latestFrameSnapshot
    }

    func enqueue(_ sampleBuffer: CMSampleBuffer) {
        let presentationTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        let presentationSeconds = presentationTime.isNumeric ? presentationTime.seconds : nil

        stateLock.lock()
        let shouldSkipFrame = if let presentationSeconds {
            presentationSeconds - lastScheduledPresentationSeconds < minimumFrameIntervalSeconds
        } else {
            false
        }
        if shouldSkipFrame {
            stateLock.unlock()
            return
        }

        if let presentationSeconds {
            lastScheduledPresentationSeconds = presentationSeconds
        }
        pendingSampleBuffer = sampleBuffer

        let shouldStartWorker = !isEncoding
        if shouldStartWorker {
            isEncoding = true
        }
        let workerGeneration = generation
        stateLock.unlock()

        guard shouldStartWorker else { return }

        queue.async { [weak self] in
            self?.encodeLoop(generation: workerGeneration)
        }
    }

    func reset() {
        stateLock.lock()
        generation += 1
        latestFrameSnapshot = nil
        pendingSampleBuffer = nil
        isEncoding = false
        lastScheduledPresentationSeconds = -Double.infinity
        nextFrameId = 1
        stateLock.unlock()
    }

    private func encodeLoop(generation workerGeneration: Int) {
        while true {
            stateLock.lock()
            guard workerGeneration == generation else {
                stateLock.unlock()
                return
            }
            guard let sampleBuffer = pendingSampleBuffer else {
                isEncoding = false
                stateLock.unlock()
                return
            }
            pendingSampleBuffer = nil
            let frameId = nextFrameId
            nextFrameId += 1
            stateLock.unlock()

            guard let snapshot = makeSnapshot(sampleBuffer: sampleBuffer, frameId: frameId) else {
                continue
            }

            stateLock.lock()
            if workerGeneration == generation {
                latestFrameSnapshot = snapshot
            }
            stateLock.unlock()
        }
    }

    private func makeSnapshot(
        sampleBuffer: CMSampleBuffer,
        frameId: Int
    ) -> CapturePreviewFrameSnapshot? {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return nil
        }

        let image = CIImage(cvPixelBuffer: imageBuffer)
        let extent = image.extent.integral
        guard extent.width > 0, extent.height > 0 else {
            return nil
        }

        let scale = min(1, maxLongEdge / max(extent.width, extent.height))
        let scaledImage = if scale < 1 {
            image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        } else {
            image
        }

        let renderExtent = scaledImage.extent.integral
        guard let cgImage = context.createCGImage(scaledImage, from: renderExtent) else {
            return nil
        }

        guard let jpegData = encodedJPEGData(from: cgImage) else {
            return nil
        }

        return CapturePreviewFrameSnapshot(
            frameId: frameId,
            bytesBase64: jpegData.base64EncodedString()
        )
    }

    private func encodedJPEGData(from cgImage: CGImage) -> Data? {
        guard let mutableData = CFDataCreateMutable(kCFAllocatorDefault, 0),
              let destination = CGImageDestinationCreateWithData(
                  mutableData,
                  UTType.jpeg.identifier as CFString,
                  1,
                  nil
              )
        else {
            return nil
        }

        let options = [
            kCGImageDestinationLossyCompressionQuality: jpegCompressionQuality
        ] as CFDictionary
        CGImageDestinationAddImage(destination, cgImage, options)

        guard CGImageDestinationFinalize(destination) else {
            return nil
        }

        return mutableData as Data
    }
}
