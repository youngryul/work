import WidgetKit
import SwiftUI

struct ScheduleWidgetEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetScheduleSnapshot
    let isLoggedIn: Bool
}

struct ScheduleWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> ScheduleWidgetEntry {
        ScheduleWidgetEntry(
            date: Date(),
            snapshot: WidgetScheduleSnapshot(
                dateString: "2026-06-12",
                dateLabel: "6월 12일 (목)",
                items: [
                    WidgetScheduleEntryItem(id: "1", title: "팀 미팅", tag: "업무"),
                    WidgetScheduleEntryItem(id: "2", title: "운동", tag: "개인"),
                ],
                updatedAt: Date()
            ),
            isLoggedIn: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (ScheduleWidgetEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ScheduleWidgetEntry>) -> Void) {
        let now = Date()
        let calendar = Calendar.current
        var entries = [makeEntry(for: now)]

        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: now)) {
            entries.append(makeEntry(for: tomorrow))
        }

        completion(Timeline(entries: entries, policy: .atEnd))
    }

    private func makeEntry(for date: Date = Date()) -> ScheduleWidgetEntry {
        let snapshot = WidgetScheduleStore.load() ?? .empty
        let hasData = !snapshot.dateString.isEmpty
        return ScheduleWidgetEntry(
            date: date,
            snapshot: snapshot,
            isLoggedIn: hasData || snapshot.updatedAt != .distantPast
        )
    }
}

struct ScheduleWidgetView: View {
    let entry: ScheduleWidgetEntry

    private var entryDateString: String {
        WidgetScheduleDateFormatter.string(from: entry.date)
    }

    private var todayLabel: String {
        WidgetScheduleDateFormatter.label(for: entryDateString)
    }

    /// 스냅샷이 위젯 기준 '오늘'과 같은 날인지
    private var isShowingToday: Bool {
        let snapshotDate = entry.snapshot.dateString
        if snapshotDate.isEmpty { return true }
        return snapshotDate == entryDateString
    }

    private var upcomingDateLabel: String {
        if entry.snapshot.dateString.isEmpty {
            return ""
        }
        if !entry.snapshot.dateLabel.isEmpty {
            return entry.snapshot.dateLabel
        }
        return WidgetScheduleDateFormatter.label(for: entry.snapshot.dateString)
    }

    private var displayItems: [WidgetScheduleEntryItem] {
        let snapshotDate = entry.snapshot.dateString
        if !snapshotDate.isEmpty, snapshotDate < entryDateString {
            return []
        }
        return entry.snapshot.items
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(todayLabel)
                .font(.system(.title3, design: .rounded))
                .fontWeight(.bold)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)

            if isShowingToday {
                todayScheduleContent
            } else {
                Text("오늘 일정 없음")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                if !upcomingDateLabel.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("다가오는 일정")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        Text(upcomingDateLabel)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.85)

                        scheduleItemsList(displayItems)
                    }
                } else {
                    Spacer(minLength: 0)
                    Text("일정 없음")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
    }

    @ViewBuilder
    private var todayScheduleContent: some View {
        if displayItems.isEmpty {
            Spacer(minLength: 0)
            Text("일정 없음")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else {
            scheduleItemsList(displayItems)
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func scheduleItemsList(_ items: [WidgetScheduleEntryItem]) -> some View {
        if items.isEmpty {
            Text("일정 없음")
                .font(.caption2)
                .foregroundStyle(.secondary)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(items.prefix(4)) { item in
                    HStack(spacing: 6) {
                        Circle()
                            .fill(tagColor(for: item.tag))
                            .frame(width: 6, height: 6)
                        Text(item.title)
                            .font(.caption)
                            .foregroundStyle(.primary)
                            .lineLimit(1)
                    }
                }

                if items.count > 4 {
                    Text("+\(items.count - 4)개 더")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func tagColor(for tag: String) -> Color {
        switch tag {
        case "업무": return .blue
        case "개인": return .purple
        case "약속": return .green
        case "가족": return .pink
        default: return .gray
        }
    }
}

struct ScheduleWidget: Widget {
    let kind: String = WidgetScheduleConstants.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ScheduleWidgetProvider()) { entry in
            ScheduleWidgetView(entry: entry)
                .widgetURL(URL(string: "potatobuddy://schedule")!)
                .containerBackground(for: .widget) {
                    Color(.systemBackground)
                }
        }
        .configurationDisplayName("오늘 일정")
        .description("오늘 일정이 없으면 다가오는 일정을 보여줍니다.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct ScheduleWidgetBundle: WidgetBundle {
    var body: some Widget {
        ScheduleWidget()
    }
}
