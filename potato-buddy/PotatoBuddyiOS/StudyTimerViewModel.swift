import Combine
import Foundation
#if canImport(ActivityKit)
import ActivityKit
#endif

enum StudyTimerState {
    case idle
    case running
    case paused
}

@MainActor
final class StudyTimerViewModel: ObservableObject {
    @Published private(set) var elapsedSeconds: Int = 0
    @Published private(set) var state: StudyTimerState = .idle
    @Published var saveError: String?
    @Published var isSaving: Bool = false
    @Published var savedMessage: String?
    @Published var selectedCategory: StudyTimerCategory = .study {
        didSet {
            syncLiveActivity()
        }
    }

    private var startDate: Date?
    private var baseSeconds: Int = 0
    private var tickTimer: AnyCancellable?

    var digitalTimeText: String {
        let h = elapsedSeconds / 3600
        let m = (elapsedSeconds % 3600) / 60
        let s = elapsedSeconds % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    var canSave: Bool {
        elapsedSeconds > 0 && state != .running && !isSaving
    }

    func start() {
        startDate = Date()
        state = .running
        startTicking()
        syncLiveActivity()
    }

    func pause() {
        guard state == .running else { return }
        if let startDate {
            baseSeconds += Int(Date().timeIntervalSince(startDate))
        }
        startDate = nil
        stopTicking()
        state = .paused
        syncLiveActivity()
    }

    func reset() {
        stopTicking()
        startDate = nil
        baseSeconds = 0
        elapsedSeconds = 0
        state = .idle
        saveError = nil
        savedMessage = nil
        endLiveActivity()
    }

    func save() async {
        guard canSave else { return }
        let secs = elapsedSeconds
        isSaving = true
        saveError = nil
        do {
            let awarded = try await SupabaseService.shared.addStudySession(
                seconds: secs,
                source: "study-timer",
                category: selectedCategory.rawValue
            )
            if awarded > 0 {
                savedMessage = "\(formatStudyDuration(secs)) 기록 완료! 젤리 +\(awarded)"
                await JellyBalanceStore.shared.refresh()
            } else {
                savedMessage = "\(formatStudyDuration(secs)) 기록 완료!"
            }
            reset()
        } catch {
            if !error.isCancellation { saveError = error.localizedDescription }
        }
        isSaving = false
    }

    private func startTicking() {
        stopTicking()
        tickTimer = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.handleTick()
            }
    }

    private func stopTicking() {
        tickTimer?.cancel()
        tickTimer = nil
    }

    private func handleTick() {
        guard state == .running, let startDate else { return }
        elapsedSeconds = baseSeconds + Int(Date().timeIntervalSince(startDate))
    }

    private func syncLiveActivity() {
        #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
            let adjustedStartDate = state == .running
                ? Date().addingTimeInterval(-Double(elapsedSeconds))
                : nil
            StudyTimerLiveActivityManager.shared.sync(
                state: state,
                elapsedSeconds: elapsedSeconds,
                startedAt: adjustedStartDate,
                category: selectedCategory
            )
        }
        #endif
    }

    private func endLiveActivity() {
        #if canImport(ActivityKit)
        if #available(iOS 16.1, *) {
            StudyTimerLiveActivityManager.shared.end()
        }
        #endif
    }
}

#if canImport(ActivityKit)
@available(iOS 16.1, *)
@MainActor
private final class StudyTimerLiveActivityManager {
    static let shared = StudyTimerLiveActivityManager()
    private var activity: Activity<StudyTimerLiveActivityAttributes>?

    func sync(
        state: StudyTimerState,
        elapsedSeconds: Int,
        startedAt: Date?,
        category: StudyTimerCategory
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

        let content = StudyTimerLiveActivityAttributes.ContentState(
            isRunning: state == .running,
            elapsedSeconds: max(0, elapsedSeconds),
            startedAt: startedAt,
            categoryLabel: category.label,
            categoryEmoji: category.emoji
        )

        if let activity {
            Task { await activity.update(ActivityContent(state: content, staleDate: nil)) }
            return
        }

        // 타이머가 실행 중일 때만 새 Live Activity 시작
        guard state == .running else { return }

        let attributes = StudyTimerLiveActivityAttributes(title: "포실이 타이머")
        do {
            activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: content, staleDate: nil)
            )
        } catch {
            // Live Activity 시작 실패는 타이머 동작에 영향을 주지 않음
        }
    }

    func end() {
        guard let activity else { return }
        let endState = StudyTimerLiveActivityAttributes.ContentState(
            isRunning: false,
            elapsedSeconds: 0,
            startedAt: nil,
            categoryLabel: "타이머",
            categoryEmoji: "🥔"
        )
        Task {
            await activity.end(
                ActivityContent(state: endState, staleDate: nil),
                dismissalPolicy: .immediate
            )
        }
        self.activity = nil
    }
}
#endif
