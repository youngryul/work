import Foundation

enum JellyRewardAmount {
    static let taskComplete = 1
    static let diaryWrite = 5
    static let habitTrackerFirstToday = 2
    static let habitTrackerOther = 1
    /// 타이머/뽀모도로 10분당 젤리
    static let studyTimerPer10Min = 1
}

enum JellyRewardReason {
    static let taskComplete = "task_complete"
    static let diaryWrite = "diary_write"
    static let habitTrackerFirstToday = "habit_tracker_first_today"
    static let stepMilestone = "step_milestone"
    static let studyTimer = "study_timer"
}

enum StudyTimerJelly {
    /// 10분
    static let intervalSeconds = 600

    static func amount(forSeconds seconds: Int) -> Int {
        let safe = max(0, seconds)
        return (safe / intervalSeconds) * JellyRewardAmount.studyTimerPer10Min
    }
}
