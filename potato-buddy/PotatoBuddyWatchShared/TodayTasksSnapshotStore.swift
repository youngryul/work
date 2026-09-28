import Foundation

/// 마지막으로 받아온 오늘 할일 (오프라인 표시 + 컴플리케이션 폴백용)
struct TodayTasksSnapshot: Codable {
    let tasks: [TaskItem]
    let updatedAt: Date
}

enum TodayTasksSnapshotStore {
    private static let key = "watch.todayTasks.snapshot"

    static func load() -> TodayTasksSnapshot? {
        guard let data = WatchConstants.sharedDefaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(TodayTasksSnapshot.self, from: data)
    }

    static func save(_ tasks: [TaskItem]) {
        let snapshot = TodayTasksSnapshot(tasks: tasks, updatedAt: Date())
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        WatchConstants.sharedDefaults.set(data, forKey: key)
    }

    static func clear() {
        WatchConstants.sharedDefaults.removeObject(forKey: key)
    }
}
