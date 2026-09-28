import Foundation
import WatchKit
import WidgetKit

@MainActor
final class TodayTasksViewModel: ObservableObject {
    @Published private(set) var tasks: [TaskItem] = []
    @Published private(set) var isLoading = false
    @Published private(set) var updatedAt: Date?
    /// 완료 처리 중인 할일 (체크 표시 후 목록에서 제거)
    @Published private(set) var completingIds: Set<String> = []
    @Published var errorMessage: String?

    private let api: TaskAPI

    init() {
        api = TaskAPI(client: WatchSessionManager.shared.apiClient)
        // 네트워크 응답 전까지 마지막 목록을 먼저 보여줌
        if let snapshot = TodayTasksSnapshotStore.load() {
            tasks = snapshot.tasks
            updatedAt = snapshot.updatedAt
        }
    }

    func refresh() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }

        do {
            let fetched = try await api.fetchTodayTasks()
            tasks = fetched
            updatedAt = Date()
            errorMessage = nil
            saveSnapshot()
        } catch {
            guard !error.isCancellation else { return }
            errorMessage = error.localizedDescription
        }
    }

    func complete(_ task: TaskItem) async {
        guard !completingIds.contains(task.id) else { return }
        completingIds.insert(task.id)
        defer { completingIds.remove(task.id) }

        do {
            try await api.completeTask(id: task.id)
            WKInterfaceDevice.current().play(.success)
            tasks.removeAll { $0.id == task.id }
            errorMessage = nil
            saveSnapshot()
        } catch {
            WKInterfaceDevice.current().play(.failure)
            errorMessage = error.localizedDescription
        }
    }

    private func saveSnapshot() {
        TodayTasksSnapshotStore.save(tasks)
        WidgetCenter.shared.reloadTimelines(ofKind: WatchWidgetKind.todayTasks)
    }
}
