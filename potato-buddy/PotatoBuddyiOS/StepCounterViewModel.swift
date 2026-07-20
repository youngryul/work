import Combine
import Foundation

@MainActor
final class StepCounterViewModel: ObservableObject {
    @Published private(set) var todaySteps: Int = 0
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage = ""
    @Published private(set) var isAvailable = StepCounterService.isAvailable
    @Published private(set) var authorizationDenied = StepCounterService.isDenied
    @Published private(set) var claimedMilestoneStepsToday: Set<Int> = []
    @Published private(set) var claimingMilestoneSteps: Int?

    private var defaultsObserver: NSObjectProtocol?

    init() {
        reloadClaimedMilestonesFromStorage()
        defaultsObserver = NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.objectWillChange.send()
        }
    }

    deinit {
        if let defaultsObserver {
            NotificationCenter.default.removeObserver(defaultsObserver)
        }
    }

    var dailyGoal: Int {
        get {
            let saved = UserDefaults.standard.integer(forKey: StepCounterConstants.dailyGoalUserDefaultsKey)
            return saved > 0 ? saved : StepCounterConstants.defaultDailyGoal
        }
        set {
            let clamped = min(
                StepCounterConstants.maxDailyGoal,
                max(StepCounterConstants.minDailyGoal, newValue)
            )
            UserDefaults.standard.set(clamped, forKey: StepCounterConstants.dailyGoalUserDefaultsKey)
            objectWillChange.send()
        }
    }

    var progress: Double {
        guard dailyGoal > 0 else { return 0 }
        return min(1, Double(todaySteps) / Double(dailyGoal))
    }

    var progressPercent: Int {
        Int((progress * 100).rounded())
    }

    var remainingSteps: Int {
        max(0, dailyGoal - todaySteps)
    }

    var goalReached: Bool {
        todaySteps >= dailyGoal
    }

    func refresh() async {
        isAvailable = StepCounterService.isAvailable
        authorizationDenied = StepCounterService.isDenied

        guard isAvailable else {
            todaySteps = 0
            return
        }

        if authorizationDenied {
            todaySteps = 0
            return
        }

        isLoading = true
        errorMessage = ""
        defer { isLoading = false }

        do {
            todaySteps = try await StepCounterService.fetchTodaySteps()
            authorizationDenied = StepCounterService.isDenied
            reloadClaimedMilestonesFromStorage()
        } catch {
            errorMessage = error.localizedDescription
            authorizationDenied = StepCounterService.isDenied
        }
    }

    /// 첫 조회 시 동작·피트니스 권한 요청이 함께 진행됩니다.
    func requestAccessAndRefresh() async {
        reloadClaimedMilestonesFromStorage()
        await refresh()
    }

    func isMilestoneReached(_ steps: Int) -> Bool {
        todaySteps >= steps
    }

    func isMilestoneClaimed(_ steps: Int) -> Bool {
        claimedMilestoneStepsToday.contains(steps)
    }

    /// 마일스톤 젤리 수령. 성공 시 지급된 젤리 수, 이미 수령·미달성 시 nil, 실패 시 throw.
    func claimJelly(forMilestoneSteps steps: Int) async throws -> Int? {
        guard isMilestoneReached(steps) else { return nil }
        guard !isMilestoneClaimed(steps) else { return nil }
        guard claimingMilestoneSteps == nil else { return nil }

        claimingMilestoneSteps = steps
        defer { claimingMilestoneSteps = nil }

        let awarded = try await SupabaseService.shared.awardJellyForStepMilestone(milestoneSteps: steps)
        markMilestoneClaimed(steps)
        if awarded > 0 {
            return awarded
        }
        return nil
    }

    private func todayClaimsStorageKey() -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        let day = formatter.string(from: Date())
        return StepCounterConstants.stepJellyClaimsUserDefaultsPrefix + day
    }

    private func reloadClaimedMilestonesFromStorage() {
        let stored = UserDefaults.standard.array(forKey: todayClaimsStorageKey()) as? [Int] ?? []
        claimedMilestoneStepsToday = Set(stored)
    }

    private func markMilestoneClaimed(_ steps: Int) {
        claimedMilestoneStepsToday.insert(steps)
        UserDefaults.standard.set(
            Array(claimedMilestoneStepsToday).sorted(),
            forKey: todayClaimsStorageKey()
        )
    }
}
