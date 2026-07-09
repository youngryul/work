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
                dateString: WidgetScheduleDateFormatter.todayString(),
                dateLabel: "6월 9일 (월)",
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

    private var displayLabel: String {
        WidgetScheduleDateFormatter.label(for: entryDateString)
    }

    private var displayItems: [WidgetScheduleEntryItem] {
        guard entry.snapshot.dateString == entryDateString else { return [] }
        return entry.snapshot.items
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(displayLabel)
                .font(.system(.headline, design: .rounded))
                .fontWeight(.bold)
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            if displayItems.isEmpty {
                Spacer(minLength: 0)
                Text("일정 없음")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(displayItems.prefix(4)) { item in
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

                    if displayItems.count > 4 {
                        Text("+\(displayItems.count - 4)개 더")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(12)
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
        .description("오늘의 일정을 한눈에 확인하세요.")
        .supportedFamilies([.systemSmall])
    }
}

@main
struct ScheduleWidgetBundle: WidgetBundle {
    var body: some Widget {
        ScheduleWidget()
    }
}
