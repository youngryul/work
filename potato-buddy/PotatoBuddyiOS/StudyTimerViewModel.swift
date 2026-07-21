import Combine
import Foundation

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
    @Published var selectedCategory: StudyTimerCategory = .study

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
    }

    func pause() {
        guard state == .running else { return }
        if let startDate {
            baseSeconds += Int(Date().timeIntervalSince(startDate))
        }
        startDate = nil
        stopTicking()
        state = .paused
    }

    func reset() {
        stopTicking()
        startDate = nil
        baseSeconds = 0
        elapsedSeconds = 0
        state = .idle
        saveError = nil
        savedMessage = nil
    }

    func save() async {
        guard canSave else { return }
        let secs = elapsedSeconds
        isSaving = true
        saveError = nil
        do {
            try await SupabaseService.shared.addStudySession(
                seconds: secs,
                source: "study-timer",
                category: selectedCategory.rawValue
            )
            savedMessage = "\(formatStudyDuration(secs)) 기록 완료!"
            reset()
        } catch {
            saveError = error.localizedDescription
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
}
