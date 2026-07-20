import Foundation

enum JellyRewardAmount {
    static let taskComplete = 1
    static let diaryWrite = 5
    static let habitTrackerFirstToday = 2
    static let habitTrackerOther = 1
}

enum JellyRewardReason {
    static let taskComplete = "task_complete"
    static let diaryWrite = "diary_write"
    static let habitTrackerFirstToday = "habit_tracker_first_today"
    static let stepMilestone = "step_milestone"
}
