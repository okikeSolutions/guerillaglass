import Foundation

/// Public enum exposed by the macOS engine module.
public enum ProjectFile {
    public static let projectJSON = "project.json"
    public static let recordingMov = "recording.mov"
    public static let systemAudioM4A = "audio_system.m4a"
    public static let micAudioM4A = "audio_mic.m4a"
    public static let eventsJSON = "events.json"
    public static let analysisDirectory = "analysis"
    public static let transcriptFullV1JSON = "transcript.full.v1.json"
    public static let transcriptWordsV1JSON = "transcript.words.v1.json"
    public static let beatMapV1JSON = "beat-map.v1.json"
    public static let qaReportV1JSON = "qa-report.v1.json"
    public static let cutPlanV1JSON = "cut-plan.v1.json"
    public static let runSummaryV1JSON = "run-summary.v1.json"
}
