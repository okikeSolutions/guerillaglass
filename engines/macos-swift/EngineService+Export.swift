import AVFoundation
import EngineProtocol
import Export
import Foundation

extension EngineService {
    func exportInfoResponse(id: String) -> EngineResponse {
        let presets = Presets.all.map { preset in
            JSONValue.object([
                "id": .string(preset.id),
                "name": .string(preset.name),
                "width": .number(Double(preset.width)),
                "height": .number(Double(preset.height)),
                "fps": .number(Double(preset.fps)),
                "fileType": .string(fileTypeIdentifier(for: preset.fileType))
            ])
        }

        return .success(id: id, result: .object(["presets": .array(presets)]))
    }

    func exportRunResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let outputPath = params["outputURL"]?.stringValue else {
            return .failure(id: id, code: "invalid_params", message: "outputURL is required")
        }
        guard let presetID = params["presetId"]?.stringValue,
              let preset = preset(for: presetID)
        else {
            return .failure(id: id, code: "invalid_params", message: "Valid presetId is required")
        }

        guard let recordingURL = captureEngine.recordingURL else {
            return .failure(id: id, code: "invalid_params", message: "No recording available to export")
        }

        do {
            let duration = try await recordingDuration(for: recordingURL)
            let trimRange = TrimRangeCalculator.timeRange(
                start: params["trimStartSeconds"]?.doubleValue ?? 0,
                end: params["trimEndSeconds"]?.doubleValue ?? duration,
                duration: duration
            )

            let outputURL = URL(fileURLWithPath: outputPath)
            _ = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: trimRange,
                outputURL: outputURL,
                cameraPlan: nil
            )
            return .success(id: id, result: .object(["outputURL": .string(outputURL.path)]))
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func exportRunCutPlanResponse(id: String, params: [String: JSONValue]) async -> EngineResponse {
        guard let outputPath = params["outputURL"]?.stringValue else {
            return .failure(id: id, code: "invalid_params", message: "outputURL is required")
        }
        guard let presetID = params["presetId"]?.stringValue,
              let preset = preset(for: presetID)
        else {
            return .failure(id: id, code: "invalid_params", message: "Valid presetId is required")
        }
        guard let jobID = params["jobId"]?.stringValue, !jobID.isEmpty else {
            return .failure(id: id, code: "invalid_params", message: "jobId is required")
        }

        do {
            let execution = try validatedCutPlanExecutionForJob(jobID: jobID)
            guard let projectURL = currentProjectURL else {
                return .failure(id: id, code: "invalid_params", message: "No active project is open.")
            }

            guard let recordingURL = resolveAgentRecordingURL(in: projectURL) else {
                return .failure(id: id, code: "invalid_params", message: "No recording available to export")
            }
            let duration = try await recordingDuration(for: recordingURL)
            let trimRange = TrimRangeCalculator.timeRange(
                start: execution.startSeconds,
                end: min(duration, execution.endSeconds),
                duration: duration
            )
            guard trimRange != nil else {
                return .failure(id: id, code: "invalid_cut_plan", message: "Unable to derive a valid trim range from cut plan.")
            }

            let outputURL = URL(fileURLWithPath: outputPath)
            _ = try await exportPipeline.export(
                recordingURL: recordingURL,
                preset: preset,
                trimRange: trimRange,
                outputURL: outputURL,
                cameraPlan: nil
            )
            return .success(
                id: id,
                result: .object([
                    "outputURL": .string(outputURL.path),
                    "appliedSegments": .number(Double(execution.segmentCount))
                ])
            )
        } catch let error as AgentModeError {
            return .failure(id: id, code: error.code, message: error.message)
        } catch {
            return .failure(id: id, code: "runtime_error", message: error.localizedDescription)
        }
    }

    func recordingDuration(for recordingURL: URL) async throws -> TimeInterval {
        if captureEngine.recordingDuration > 0 {
            return captureEngine.recordingDuration
        }
        let asset = AVAsset(url: recordingURL)
        let duration = try await asset.load(.duration)
        let seconds = duration.seconds
        if seconds > 0 {
            return seconds
        }

        if let audioDuration = try? fallbackAudioDuration(for: recordingURL), audioDuration > 0 {
            return audioDuration
        }
        return seconds
    }

    private func fallbackAudioDuration(for recordingURL: URL) throws -> TimeInterval {
        let audioFile = try AVAudioFile(forReading: recordingURL)
        let sampleRate = audioFile.processingFormat.sampleRate
        guard sampleRate > 0 else { return 0 }
        return Double(audioFile.length) / sampleRate
    }

    func preset(for id: String) -> ExportPreset? {
        Presets.all.first(where: { $0.id == id })
    }

    func fileTypeIdentifier(for fileType: AVFileType) -> String {
        switch fileType {
        case .mp4:
            "mp4"
        default:
            "mov"
        }
    }
}
