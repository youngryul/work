import Foundation

#if canImport(ActivityKit)
import ActivityKit

@available(iOS 16.1, *)
struct StudyTimerLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var isRunning: Bool
        var elapsedSeconds: Int
        var startedAt: Date?
        var categoryLabel: String
        var categoryEmoji: String
    }

    var title: String
}
#endif

