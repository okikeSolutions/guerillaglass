import Darwin
import Foundation

struct CaptureRuntimeTelemetrySnapshot {
    let cpuPercent: Double?
    let memoryBytes: UInt64?
    let recordingBitrateMbps: Double?
}

final class CaptureRuntimeTelemetryMonitor {
    private var previousCPUTimeSeconds: Double?
    private var previousSampleUptimeSeconds: TimeInterval?
    private var previousOutputBytes: Double?
    private var smoothedCPUPercent: Double?
    private var smoothedBitrateMbps: Double?
    private let cpuSmoothingFactor = 0.22
    private let bitrateSmoothingFactor = 0.3

    func reset() {
        previousCPUTimeSeconds = nil
        previousSampleUptimeSeconds = nil
        previousOutputBytes = nil
        smoothedCPUPercent = nil
        smoothedBitrateMbps = nil
    }

    func sample(recordingOutputURL: URL?, recordingDurationSeconds: Double) -> CaptureRuntimeTelemetrySnapshot {
        let uptimeSeconds = ProcessInfo.processInfo.systemUptime
        let cpuTimeSeconds = readProcessCPUTimeSeconds()
        let memoryBytes = readPhysicalFootprintBytes()
        let currentOutputBytes = readOutputBytes(recordingOutputURL: recordingOutputURL)

        defer {
            previousSampleUptimeSeconds = uptimeSeconds
            previousCPUTimeSeconds = cpuTimeSeconds
            previousOutputBytes = currentOutputBytes
        }

        let cpuPercent = sampleCPUPercent(
            uptimeSeconds: uptimeSeconds,
            cpuTimeSeconds: cpuTimeSeconds
        )

        let recordingBitrateMbps = sampleRecordingBitrateMbps(
            uptimeSeconds: uptimeSeconds,
            recordingDurationSeconds: recordingDurationSeconds,
            currentOutputBytes: currentOutputBytes
        )

        return CaptureRuntimeTelemetrySnapshot(
            cpuPercent: cpuPercent,
            memoryBytes: memoryBytes,
            recordingBitrateMbps: recordingBitrateMbps
        )
    }

    private func sampleCPUPercent(
        uptimeSeconds: TimeInterval,
        cpuTimeSeconds: Double?
    ) -> Double? {
        guard
            let cpuTimeSeconds,
            let previousCPUTimeSeconds,
            let previousSampleUptimeSeconds
        else {
            return nil
        }

        let deltaUptime = uptimeSeconds - previousSampleUptimeSeconds
        guard deltaUptime > 0 else {
            return smoothedCPUPercent
        }

        let deltaCPU = max(0, cpuTimeSeconds - previousCPUTimeSeconds)
        let rawPercent = (deltaCPU / deltaUptime) * 100
        let maxPercent = Double(max(1, ProcessInfo.processInfo.activeProcessorCount)) * 100
        let clampedRawPercent = min(maxPercent, max(0, rawPercent))
        let nextCPUPercent: Double
        if let smoothedCPUPercent {
            nextCPUPercent =
                smoothedCPUPercent + (clampedRawPercent - smoothedCPUPercent) * cpuSmoothingFactor
        } else {
            nextCPUPercent = clampedRawPercent
        }
        smoothedCPUPercent = nextCPUPercent
        return nextCPUPercent
    }

    private func sampleRecordingBitrateMbps(
        uptimeSeconds: TimeInterval,
        recordingDurationSeconds: Double,
        currentOutputBytes: Double?
    ) -> Double? {
        guard
            recordingDurationSeconds > 0.1,
            let currentOutputBytes
        else {
            smoothedBitrateMbps = nil
            return nil
        }

        let rawBitrateMbps: Double? = if
            let previousSampleUptimeSeconds,
            let previousOutputBytes
        {
            let deltaUptime = uptimeSeconds - previousSampleUptimeSeconds
            let deltaBytes = currentOutputBytes - previousOutputBytes
            if deltaUptime > 0, deltaBytes >= 0 {
                (deltaBytes * 8 / deltaUptime) / 1_000_000
            } else {
                nil
            }
        } else {
            (currentOutputBytes * 8 / recordingDurationSeconds) / 1_000_000
        }

        guard let rawBitrateMbps else {
            return smoothedBitrateMbps
        }

        let clampedRawBitrate = max(0, rawBitrateMbps)
        let nextBitrateMbps: Double
        if let smoothedBitrateMbps {
            nextBitrateMbps =
                smoothedBitrateMbps + (clampedRawBitrate - smoothedBitrateMbps) * bitrateSmoothingFactor
        } else {
            nextBitrateMbps = clampedRawBitrate
        }
        smoothedBitrateMbps = nextBitrateMbps
        return nextBitrateMbps
    }

    private func readProcessCPUTimeSeconds() -> Double? {
        var usage = rusage()
        guard getrusage(RUSAGE_SELF, &usage) == 0 else {
            return nil
        }

        let userSeconds = Double(usage.ru_utime.tv_sec) + Double(usage.ru_utime.tv_usec) / 1_000_000
        let systemSeconds =
            Double(usage.ru_stime.tv_sec) + Double(usage.ru_stime.tv_usec) / 1_000_000
        return userSeconds + systemSeconds
    }

    private func readPhysicalFootprintBytes() -> UInt64? {
        var info = task_vm_info_data_t()
        var infoCount = mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.stride / MemoryLayout<integer_t>.stride)
        let result = withUnsafeMutablePointer(to: &info) { pointer in
            pointer.withMemoryRebound(to: integer_t.self, capacity: Int(infoCount)) { rebound in
                task_info(
                    mach_task_self_,
                    task_flavor_t(TASK_VM_INFO),
                    rebound,
                    &infoCount
                )
            }
        }

        guard result == KERN_SUCCESS else {
            return nil
        }
        return UInt64(info.phys_footprint)
    }

    private func readOutputBytes(recordingOutputURL: URL?) -> Double? {
        guard let recordingOutputURL else {
            return nil
        }
        guard
            let attributes = try? FileManager.default.attributesOfItem(atPath: recordingOutputURL.path),
            let fileSizeBytes = (attributes[.size] as? NSNumber)?.doubleValue,
            fileSizeBytes >= 0
        else {
            return nil
        }
        return fileSizeBytes
    }
}
