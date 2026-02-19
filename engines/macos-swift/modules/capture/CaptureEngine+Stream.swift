import CoreImage
import ScreenCaptureKit

extension CaptureEngine: SCStreamOutput, SCStreamDelegate {
    public func stream(
        _: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        guard outputType == .screen else { return }
        let status = frameStatus(for: sampleBuffer)
        recordVideoSample(status: status, sampleBuffer: sampleBuffer)

        guard status == nil || status == .complete,
              let imageBuffer = sampleBuffer.imageBuffer else { return }

        appendVideoSample(sampleBuffer)

        let ciImage = CIImage(cvImageBuffer: imageBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }

        Task { @MainActor in
            self.setLatestFrame(cgImage)
        }
    }

    public func stream(_: SCStream, didStopWithError error: Error) {
        audioCapture.stop()
        Task { @MainActor in
            self.setRunning(false)
            self.lastError = error.localizedDescription
        }
    }
}
