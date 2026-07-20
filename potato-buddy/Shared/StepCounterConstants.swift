import Foundation

struct StepJellyMilestone: Identifiable, Hashable {
    let steps: Int
    let jellyAmount: Int

    var id: Int { steps }
}

enum StepCounterConstants {
    static let defaultDailyGoal = 10_000
    static let dailyGoalUserDefaultsKey = "stepDailyGoal"
    static let minDailyGoal = 3_000
    static let maxDailyGoal = 30_000
    static let goalStepIncrement = 1_000

    /// 오늘 걸음 마일스톤 달성 시 1회 수령 가능한 젤리
    static let jellyMilestones: [StepJellyMilestone] = [
        StepJellyMilestone(steps: 3_000, jellyAmount: 3),
        StepJellyMilestone(steps: 8_000, jellyAmount: 5),
        StepJellyMilestone(steps: 100_000, jellyAmount: 8),
    ]

    static let stepJellyClaimsUserDefaultsPrefix = "stepJellyClaims-"
}
