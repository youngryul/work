import SwiftUI
import Combine

@MainActor
final class TodoViewModel: ObservableObject {

    // MARK: - Published State

    @Published var tasks:          [TaskItem]  = []
    @Published var isLoading:       Bool       = false
    @Published var isBubbleVisible: Bool       = false
    @Published var newTaskTitle:    String     = ""
    @Published var isAdding:        Bool       = false
    @Published var completingIds:   Set<String> = []

    // MARK: - 자동 갱신 타이머

    private var refreshTimer: AnyCancellable?
    private let refreshInterval: TimeInterval = 30 // 30초마다 갱신

    // MARK: - 버블 토글

    func toggleBubble() {
        withAnimation(.spring(response: 0.32, dampingFraction: 0.72)) {
            isBubbleVisible.toggle()
        }
        if isBubbleVisible {
            Task { await fetchTasks() }
            startAutoRefresh()
        } else {
            stopAutoRefresh()
        }
    }

    // MARK: - 자동 갱신

    private func startAutoRefresh() {
        stopAutoRefresh()
        refreshTimer = Timer.publish(every: refreshInterval, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                guard let self, self.isBubbleVisible else { return }
                Task { await self.fetchTasks() }
            }
    }

    private func stopAutoRefresh() {
        refreshTimer?.cancel()
        refreshTimer = nil
    }

    // MARK: - Supabase 연동

    func fetchTasks() async {
        isLoading = true
        tasks = (try? await SupabaseService.shared.fetchTodayTasks()) ?? []
        isLoading = false
    }

    func completeTask(_ task: TaskItem) async {
        completingIds.insert(task.id)
        try? await SupabaseService.shared.completeTask(id: task.id)
        tasks.removeAll { $0.id == task.id }
        completingIds.remove(task.id)
    }

    func addTask() async {
        let title = newTaskTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        isAdding     = true
        newTaskTitle = ""
        do {
            try await SupabaseService.shared.addTask(title: title)
            await fetchTasks()
        } catch {
            newTaskTitle = title
        }
        isAdding = false
    }
}
