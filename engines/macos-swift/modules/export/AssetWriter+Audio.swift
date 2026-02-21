import AVFoundation
import Foundation

extension AssetWriter {
    func appendAudioSynchronously(buffer: AVAudioPCMBuffer, time: AVAudioTime) {
        guard canAppendAudio(time: time) else { return }

        do {
            try ensureAudioInputConfigured(format: buffer.format)
        } catch {
            return
        }

        let presentationTimestamp = audioPresentationTimestamp(for: buffer, time: time)
        guard let sampleBuffer = try? makeAudioSampleBuffer(
            buffer: buffer,
            presentationTimeStamp: presentationTimestamp
        ) else { return }

        guard let audioInput, audioInput.isReadyForMoreMediaData else { return }
        audioInput.append(sampleBuffer)
    }

    private func canAppendAudio(time: AVAudioTime) -> Bool {
        if isFinishing {
            return false
        }
        if writer.status != .writing, writer.status != .unknown {
            return false
        }
        if videoBaseTime == nil {
            return false
        }
        return time.isSampleTimeValid
    }

    private func ensureAudioInputConfigured(format: AVAudioFormat) throws {
        guard audioInput == nil else { return }

        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: format.sampleRate,
            AVNumberOfChannelsKey: format.channelCount,
            AVEncoderBitRateKey: 192_000
        ]

        let input = AVAssetWriterInput(mediaType: .audio, outputSettings: settings)
        input.expectsMediaDataInRealTime = true
        guard writer.canAdd(input) else {
            throw AssetWriterError.cannotAddAudioInput
        }
        writer.add(input)
        audioInput = input
    }

    private func audioPresentationTimestamp(for buffer: AVAudioPCMBuffer, time: AVAudioTime) -> CMTime {
        let baseSample = audioBaseSampleTime ?? time.sampleTime
        if audioBaseSampleTime == nil {
            audioBaseSampleTime = baseSample
        }
        let sampleOffset = time.sampleTime - baseSample
        return CMTime(
            value: CMTimeValue(sampleOffset),
            timescale: CMTimeScale(buffer.format.sampleRate)
        )
    }

    private func makeAudioSampleBuffer(
        buffer: AVAudioPCMBuffer,
        presentationTimeStamp: CMTime
    ) throws -> CMSampleBuffer {
        let formatDescription = try makeAudioFormatDescription(for: buffer)

        let frameCount = CMTimeValue(buffer.frameLength)
        var timing = CMSampleTimingInfo(
            duration: CMTime(value: frameCount, timescale: CMTimeScale(buffer.format.sampleRate)),
            presentationTimeStamp: presentationTimeStamp,
            decodeTimeStamp: .invalid
        )

        var sampleBuffer: CMSampleBuffer?
        var status = CMSampleBufferCreate(
            allocator: kCFAllocatorDefault,
            dataBuffer: nil,
            dataReady: false,
            makeDataReadyCallback: nil,
            refcon: nil,
            formatDescription: formatDescription,
            sampleCount: CMItemCount(buffer.frameLength),
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleSizeEntryCount: 0,
            sampleSizeArray: nil,
            sampleBufferOut: &sampleBuffer
        )

        guard status == noErr, let sampleBuffer else {
            throw AssetWriterError.invalidAudioFormat
        }

        status = CMSampleBufferSetDataBufferFromAudioBufferList(
            sampleBuffer,
            blockBufferAllocator: kCFAllocatorDefault,
            blockBufferMemoryAllocator: kCFAllocatorDefault,
            flags: 0,
            bufferList: buffer.audioBufferList
        )
        guard status == noErr else {
            throw AssetWriterError.invalidAudioFormat
        }
        status = CMSampleBufferMakeDataReady(sampleBuffer)
        guard status == noErr else {
            throw AssetWriterError.invalidAudioFormat
        }

        return sampleBuffer
    }

    private func makeAudioFormatDescription(
        for buffer: AVAudioPCMBuffer
    ) throws -> CMAudioFormatDescription {
        let streamDescription = buffer.format.streamDescription
        var formatDescription: CMAudioFormatDescription?
        let status = CMAudioFormatDescriptionCreate(
            allocator: kCFAllocatorDefault,
            asbd: streamDescription,
            layoutSize: 0,
            layout: nil,
            magicCookieSize: 0,
            magicCookie: nil,
            extensions: nil,
            formatDescriptionOut: &formatDescription
        )
        guard status == noErr, let formatDescription else {
            throw AssetWriterError.invalidAudioFormat
        }
        return formatDescription
    }
}
