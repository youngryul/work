import Combine
import Foundation

@MainActor
final class StepCounterViewModel: ObservableObject {
    @Published private(set) var todaySteps: Int = 0
    @Published private(set) var isLoading = false
    @Published private(set) var errorMessage = ""
    @Published private(set) var isAvailable = StepCounterService.isAvailable
    @Published private(set) var authorizationDenied = StepCounterService.isDenied

    private var defaultsObserver: NSObjectProtocol?

    init() {
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
        } catch {
            errorMessage = error.localizedDescription
            authorizationDenied = StepCounterService.isDenied
        }
    }

    /// 첫 조회 시 동작·피트니스 권한 요청이 함께 진행됩니다.
    func requestAccessAndRefresh() async {
        await refresh()
    }
}
