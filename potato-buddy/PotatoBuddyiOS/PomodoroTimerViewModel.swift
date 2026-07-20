import Combine
import Foundation
import UIKit

enum PomodoroDuration: Int, CaseIterable, Identifiable {
    case fifteen = 15
    case twentyFive = 25
    case thirtyFive = 35
    case fifty = 50

    var id: Int { rawValue }

    var label: String {
        "\(rawValue)분"
    }
}

enum PomodoroTimerState {
    case idle
    case running
    case paused
    case finished
}

@MainActor
final class PomodoroTimerViewModel: ObservableObject {
    @Published private(set) var selectedMinutes: Int = PomodoroDuration.twentyFive.rawValue
    @Published private(set) var remainingSeconds: Int = PomodoroDuration.twentyFive.rawValue * 60
    @Published private(set) var state: PomodoroTimerState = .idle

    private var totalSeconds: Int = PomodoroDuration.twentyFive.rawValue * 60
    private var endDate: Date?
    private var tickTimer: AnyCancellable?

    var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        let elapsed = totalSeconds - remainingSeconds
        return min(1, max(0, Double(elapsed) / Double(totalSeconds)))
    }

    var elapsedSeconds: Int {
        totalSeconds - remainingSeconds
    }

    var digitalTimeText: String {
        let minutes = remainingSeconds / 60
        let seconds = remainingSeconds % 60
        return String(format: "%02d:%02d", minutes, seconds)
    }

    var canChangeDuration: Bool {
        state == .idle || state == .finished
    }

    func selectDuration(_ minutes: Int) {
        guard canChangeDuration else { return }
        selectedMinutes = minutes
        totalSeconds = minutes * 60
        remainingSeconds = totalSeconds
        state = .idle
    }

    func start() {
        if state == .paused {
            endDate = Date().addingTimeInterval(TimeInterval(remainingSeconds))
        } else {
            totalSeconds = selectedMinutes * 60
            remainingSeconds = totalSeconds
            endDate = Date().addingTimeInterval(TimeInterval(totalSeconds))
        }

        state = .running
        startTicking()
    }

    func pause() {
        guard state == .running else { return }
        syncRemainingFromEndDate()
        endDate = nil
        stopTicking()
        state = .paused
    }

    func reset() {
        stopTicking()
        endDate = nil
        totalSeconds = selectedMinutes * 60
        remainingSeconds = totalSeconds
        state = .idle
    }

    func syncWhenAppBecomesActive() {
        guard state == .running else { return }
        syncRemainingFromEndDate()
        if remainingSeconds <= 0 {
            finishTimer()
        }
    }

    private func startTicking() {
        stopTicking()
        tickTimer = Timer.publish(every: 0.05, on: .main, in: .common)
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
        guard state == .running else { return }
        syncRemainingFromEndDate()
        if remainingSeconds <= 0 {
            finishTimer()
        }
    }

    private func syncRemainingFromEndDate() {
        guard let endDate else { return }
        remainingSeconds = max(0, Int(ceil(endDate.timeIntervalSinceNow)))
    }

    private func finishTimer() {
        stopTicking()
        endDate = nil
        remainingSeconds = 0
        state = .finished
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
