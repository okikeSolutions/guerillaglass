import Foundation

extension RecordingPlaybackView {
    var playbackRates: [Double] {
        [0.5, 0.75, 1.0, 1.25, 1.5, 2.0]
    }

    func rateLabel(_ rate: Double) -> String {
        let formatted = rate.truncatingRemainder(dividingBy: 1) == 0
            ? String(format: "%.0f", rate)
            : String(format: "%.2g", rate)
        return "\(formatted)x"
    }
}
