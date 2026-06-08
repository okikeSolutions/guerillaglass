import ScreenCaptureKit

extension CaptureEngine: SCStreamOutput, SCStreamDelegate {
    public func stream(
        _: SCStream,
        didOutputSampleBuffer sampleBuffer: CMSampleBuffer,
        of outputType: SCStreamOutputType
    ) {
        let callbackStart = DispatchTime.now().uptimeNanoseconds
        defer {
            let elapsedMs = Double(DispatchTime.now().uptimeNanoseconds - callbackStart) / 1_000_000
            recordCaptureCallbackDuration(elapsedMs)
        }

        guard outputType == .screen else { return }
        let status = frameStatus(for: sampleBuffer)
        if shouldResolveStartupHandshake(for: status) {
            resolveStartupHandshakeIfNeeded(.success(()))
        }
        if !hasLoggedFirstVideoSample {
            hasLoggedFirstVideoSample = true
            debugLog("received first video sample status=\(String(describing: status))")
        }
        recordVideoSample(status: status, sampleBuffer: sampleBuffer)

        guard status == nil || status == .complete else { return }

        cacheLatestCompleteVideoSample(sampleBuffer)
        cachePreviewSample(sampleBuffer)
        appendVideoSample(sampleBuffer)
    }

    public func stream(_: SCStream, didStopWithError error: Error) {
        debugLog("stream didStopWithError error=\(String(describing: error))")
        resolveStartupHandshakeIfNeeded(.failure(error))
        audioCapture.stop()
        clearPreviewFrame()
        clearLatestCompleteVideoSample()
        Task { @MainActor in
            self.setRunning(false)
            self.lastError = error.localizedDescription
        }
    }
}
