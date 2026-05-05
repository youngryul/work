import WidgetKit

// MARK: - 감자 상태 (30초마다 교체)

struct PotatoState {
    let accessory: String   // 감자 옆 액세서리 이모지

    static let all: [PotatoState] = [
        PotatoState(accessory: ""),    // 기본
        PotatoState(accessory: "💤"),  // 졸림
        PotatoState(accessory: "☕"),  // 커피
        PotatoState(accessory: "🎵"),  // 음악
        PotatoState(accessory: "📚"),  // 공부
        PotatoState(accessory: "🌙"),  // 밤
        PotatoState(accessory: "✨"),  // 반짝
        PotatoState(accessory: "🔥"),  // 파이팅
    ]
}

// MARK: - Timeline Entry

struct TaskEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskItem]
    let potatoState: PotatoState

    static let placeholder = TaskEntry(
        date: .now,
        tasks: [
            TaskItem(id: "1", title: "일기 작성하기",        category: nil,    priority: 0),
            TaskItem(id: "2", title: "5년 질문 답변하기",    category: nil,    priority: 1),
            TaskItem(id: "3", title: "운동하기",             category: "건강", priority: 2),
        ],
        potatoState: PotatoState.all[0]
    )
}

// MARK: - Timeline Provider

struct TaskProvider: TimelineProvider {
    func placeholder(in context: Context) -> TaskEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (TaskEntry) -> Void) {
        completion(.placeholder)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskEntry>) -> Void) {
        Task {
            let tasks = (try? await SupabaseService.shared.fetchTodayTasks()) ?? []
            let states = PotatoState.all
            var entries: [TaskEntry] = []

            // 30초마다 감자 상태 변경 (8가지 × 30초 = 4분 주기)
            // 2사이클 생성 → 총 8분 뒤 새 타임라인 요청 (할일도 갱신)
            for cycle in 0..<2 {
                for (i, state) in states.enumerated() {
                    let offset = (cycle * states.count + i) * 30
                    let date = Calendar.current.date(byAdding: .second, value: offset, to: .now)!
                    entries.append(TaskEntry(date: date, tasks: tasks, potatoState: state))
                }
            }

            completion(Timeline(entries: entries, policy: .atEnd))
        }
    }
}
