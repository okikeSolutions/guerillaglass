#!/usr/bin/env swift

import AppKit
import AVFoundation
import CoreVideo
import Foundation

func makePixelBuffer(width: Int, height: Int, frameIndex: Int) -> CVPixelBuffer? {
    var pixelBuffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        [
            kCVPixelBufferCGImageCompatibilityKey: true,
            kCVPixelBufferCGBitmapContextCompatibilityKey: true,
        ] as CFDictionary,
        &pixelBuffer
    )
    guard status == kCVReturnSuccess, let pixelBuffer else { return nil }
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else { return nil }
    let bytes = base.assumingMemoryBound(to: UInt8.self)
    let rowBytes = CVPixelBufferGetBytesPerRow(pixelBuffer)
    let section = (frameIndex / 30) % 4
    let colors: [(UInt8, UInt8, UInt8)] = [
        (20, 40, 220),
        (40, 200, 60),
        (220, 80, 30),
        (180, 40, 180),
    ]
    let color = colors[section]
    for row in 0 ..< height {
        for column in 0 ..< width {
            let offset = row * rowBytes + column * 4
            bytes[offset] = color.2
            bytes[offset + 1] = color.1
            bytes[offset + 2] = color.0
            bytes[offset + 3] = 255
        }
    }
    return pixelBuffer
}

if CommandLine.arguments.count >= 3, CommandLine.arguments[1] == "--probe" {
    let asset = AVAsset(url: URL(fileURLWithPath: CommandLine.arguments[2]))
    let duration = try await asset.load(.duration).seconds
    let tracks = try await asset.loadTracks(withMediaType: .video)
    let size = try await tracks.first?.load(.naturalSize) ?? .zero
    var sampleColors: [[Int]] = []
    if CommandLine.arguments.count == 4 {
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        for value in CommandLine.arguments[3].split(separator: ",") {
            guard let seconds = Double(value) else { continue }
            let (image, _) = try await generator.image(at: CMTime(seconds: seconds, preferredTimescale: 600))
            let bitmap = NSBitmapImageRep(cgImage: image)
            let color = bitmap.colorAt(x: image.width / 2, y: image.height / 2)?.usingColorSpace(.sRGB)
            sampleColors.append([
                Int((color?.redComponent ?? 0) * 255),
                Int((color?.greenComponent ?? 0) * 255),
                Int((color?.blueComponent ?? 0) * 255),
            ])
        }
    }
    let payload: [String: Any] = [
        "durationSeconds": duration,
        "width": size.width,
        "height": size.height,
        "hasVideo": !tracks.isEmpty,
        "sampleColors": sampleColors,
    ]
    let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
    print(String(decoding: data, as: UTF8.self))
    exit(0)
}

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write(Data("usage: macos_agent_fixture.swift <output.mov> | --probe <media>\n".utf8))
    exit(2)
}

let outputURL = URL(fileURLWithPath: CommandLine.arguments[1])
try? FileManager.default.removeItem(at: outputURL)
let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
let width = 320
let height = 180
let fps: Int32 = 30
let input = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
        AVVideoCodecKey: AVVideoCodecType.h264,
        AVVideoWidthKey: width,
        AVVideoHeightKey: height,
    ]
)
input.expectsMediaDataInRealTime = false
guard writer.canAdd(input) else { throw NSError(domain: "AgentFixture", code: 1) }
writer.add(input)
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.startWriting() else { throw writer.error ?? NSError(domain: "AgentFixture", code: 2) }
writer.startSession(atSourceTime: .zero)
for frame in 0 ..< 240 {
    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.001)
    }
    guard let pixelBuffer = makePixelBuffer(width: width, height: height, frameIndex: frame),
          adaptor.append(pixelBuffer, withPresentationTime: CMTime(value: Int64(frame), timescale: fps))
    else { throw writer.error ?? NSError(domain: "AgentFixture", code: 3) }
}

input.markAsFinished()
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
semaphore.wait()
guard writer.status == .completed else {
    throw writer.error ?? NSError(domain: "AgentFixture", code: 4)
}

print(outputURL.path)
