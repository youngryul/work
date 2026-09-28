import SwiftUI
import WidgetKit

struct TodayTasksEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskItem]
    let isLoggedIn: Bool
}

struct TodayTasksProvider: TimelineProvider {
    /// 워치 앱을 열지 않아도 주기적으로 새로 가져오는 간격
    private let refreshInterval: TimeInterval = 30 * 60

    func placeholder(in context: Context) -> TodayTasksEntry {
        TodayTasksEntry(
            date: Date(),
            tasks: [
                TaskItem(id: "1", title: "운동하기", category: nil, priority: 1, createdat: nil),
                TaskItem(id: "2", title: "책 30쪽 읽기", category: nil, priority: 2, createdat: nil),
            ],
            isLoggedIn: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayTasksEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : cachedEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayTasksEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let next = Date().addingTimeInterval(refreshInterval)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    /// 네트워크로 최신 목록을 받고, 실패하면 마지막 캐시 사용
    /// (위젯에서는 폰과 통신할 수 없어 토큰이 만료되면 캐시로 표시 → 워치 앱을 열면 갱신됨)
    private func fetchEntry() async -> TodayTasksEntry {
        guard WatchCredentialStore.load() != nil else {
            return TodayTasksEntry(date: Date(), tasks: [], isLoggedIn: false)
        }
        do {
            let tasks = try await TaskAPI(client: WatchAPIClient()).fetchTodayTasks()
            TodayTasksSnapshotStore.save(tasks)
            return TodayTasksEntry(date: Date(), tasks: tasks, isLoggedIn: true)
        } catch {
            return cachedEntry()
        }
    }

    private func cachedEntry() -> TodayTasksEntry {
        TodayTasksEntry(
            date: Date(),
            tasks: TodayTasksSnapshotStore.load()?.tasks ?? [],
            isLoggedIn: WatchCredentialStore.load() != nil
        )
    }
}

struct TodayTasksComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayTasksEntry

    private var countText: String {
        entry.isLoggedIn ? "\(entry.tasks.count)" : "-"
    }

    var body: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Image(systemName: "checklist")
                        .font(.caption2)
                    Text(countText)
                        .font(.title3.bold())
                        .minimumScaleFactor(0.6)
                }
            }

        case .accessoryCorner:
            Image(systemName: "checklist")
                .font(.title3)
                .widgetLabel {
                    Text(entry.isLoggedIn ? "할일 \(entry.tasks.count)개" : "로그인 필요")
                }

        case .accessoryInline:
            if !entry.isLoggedIn {
                Text("포실이 로그인 필요")
            } else if let first = entry.tasks.first {
                Text("할일 \(entry.tasks.count) · \(first.title)")
            } else {
                Text("오늘 할일 완료 🥔")
            }

        default:
            rectangular
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Label("오늘 할일", systemImage: "checklist")
                    .font(.headline)
                    .widgetAccentable()
                Spacer(minLength: 0)
                Text(countText)
                    .font(.headline)
            }

            if !entry.isLoggedIn {
                Text("아이폰 앱에서 로그인해 주세요")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            } else if entry.tasks.isEmpty {
                Text("모두 끝냈어요! 🥔")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(entry.tasks.prefix(2)) { task in
                    Text("· \(task.displayTitle)")
                        .font(.caption)
                        .lineLimit(1)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TodayTasksComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: WatchWidgetKind.todayTasks, provider: TodayTasksProvider()) { entry in
            TodayTasksComplicationView(entry: entry)
                .widgetURL(WatchDeepLink.todayTasks)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("오늘 할일")
        .description("남은 오늘 할일 개수와 목록을 보여줍니다.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}
