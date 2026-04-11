import Foundation

/// Public value type exposed by the macOS engine module.
public struct Project: Codable, Identifiable, Equatable {
    public let id: UUID
    public var createdAt: Date
    public var autoZoom: AutoZoomSettings
    public var timeline: TimelineDocument
    public var captureMetadata: CaptureMetadata?
    public var lastRecordingTelemetry: CaptureTelemetrySummary?
    public var agentAnalysis: AgentAnalysisMetadata?

    public init(
        id: UUID = UUID(),
        createdAt: Date = Date(),
        autoZoom: AutoZoomSettings = AutoZoomSettings(),
        timeline: TimelineDocument = TimelineDocument(),
        captureMetadata: CaptureMetadata? = nil,
        lastRecordingTelemetry: CaptureTelemetrySummary? = nil,
        agentAnalysis: AgentAnalysisMetadata? = nil
    ) {
        self.id = id
        self.createdAt = createdAt
        self.autoZoom = autoZoom
        self.timeline = timeline
        self.captureMetadata = captureMetadata
        self.lastRecordingTelemetry = lastRecordingTelemetry
        self.agentAnalysis = agentAnalysis
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case createdAt
        case autoZoom
        case timeline
        case captureMetadata
        case lastRecordingTelemetry
        case agentAnalysis
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        autoZoom = try container.decodeIfPresent(AutoZoomSettings.self, forKey: .autoZoom) ?? AutoZoomSettings()
        timeline = try container.decodeIfPresent(TimelineDocument.self, forKey: .timeline) ?? TimelineDocument()
        captureMetadata = try container.decodeIfPresent(CaptureMetadata.self, forKey: .captureMetadata)
        lastRecordingTelemetry = try container.decodeIfPresent(
            CaptureTelemetrySummary.self,
            forKey: .lastRecordingTelemetry
        )
        agentAnalysis = try container.decodeIfPresent(AgentAnalysisMetadata.self, forKey: .agentAnalysis)
    }
}

/// Persisted summary of the latest completed recording telemetry shown in edit surfaces.
public struct CaptureTelemetrySummary: Codable, Equatable {
    public var sourceDroppedFrames: Int
    public var writerDroppedFrames: Int
    public var writerBackpressureDrops: Int
    public var achievedFps: Double
    public var cpuPercent: Double?
    public var memoryBytes: UInt64?
    public var recordingBitrateMbps: Double?
    public var captureCallbackMs: Double
    public var recordQueueLagMs: Double
    public var writerAppendMs: Double
    public var previewEncodeMs: Double?

    public init(
        sourceDroppedFrames: Int = 0,
        writerDroppedFrames: Int = 0,
        writerBackpressureDrops: Int = 0,
        achievedFps: Double = 0,
        cpuPercent: Double? = nil,
        memoryBytes: UInt64? = nil,
        recordingBitrateMbps: Double? = nil,
        captureCallbackMs: Double = 0,
        recordQueueLagMs: Double = 0,
        writerAppendMs: Double = 0,
        previewEncodeMs: Double? = nil
    ) {
        self.sourceDroppedFrames = sourceDroppedFrames
        self.writerDroppedFrames = writerDroppedFrames
        self.writerBackpressureDrops = writerBackpressureDrops
        self.achievedFps = achievedFps
        self.cpuPercent = cpuPercent
        self.memoryBytes = memoryBytes
        self.recordingBitrateMbps = recordingBitrateMbps
        self.captureCallbackMs = captureCallbackMs
        self.recordQueueLagMs = recordQueueLagMs
        self.writerAppendMs = writerAppendMs
        self.previewEncodeMs = previewEncodeMs
    }
}
