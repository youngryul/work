import WidgetKit
import SwiftUI
#if canImport(ActivityKit)
import ActivityKit
#endif

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

        // 다음 자정 엔트리 추가
        if let nextMidnight = calendar.date(
            byAdding: .day, value: 1, to: calendar.startOfDay(for: now)
        ) {
            entries.append(makeEntry(for: nextMidnight))
        }

        // 자정에 타임라인을 다시 생성하도록 .after(nextMidnight) 정책 사용
        let nextMidnight = calendar.date(
            byAdding: .day, value: 1, to: calendar.startOfDay(for: now)
        ) ?? calendar.date(byAdding: .hour, value: 24, to: now)!

        completion(Timeline(entries: entries, policy: .after(nextMidnight)))
    }

    private func makeEntry(for date: Date = Date()) -> ScheduleWidgetEntry {
        let dateString = WidgetScheduleDateFormatter.string(from: date)
        // 날짜별 스냅샷 우선, 없으면 레거시 단일 스냅샷으로 폴백
        let snapshot = WidgetScheduleStore.load(forDate: dateString)
                    ?? WidgetScheduleStore.load()
                    ?? .empty
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

#if canImport(ActivityKit)
@available(iOS 16.1, *)
struct StudyTimerLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StudyTimerLiveActivityAttributes.self) { context in
            HStack(spacing: 10) {
                Text("포실이")
                    .font(.headline.bold())
                Text(context.state.categoryEmoji)
                    .font(.title3)
                timerText(for: context.state)
                    .font(.system(.title3, design: .rounded).monospacedDigit().weight(.bold))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .activityBackgroundTint(.black.opacity(0.88))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("포실이 \(context.state.categoryEmoji)")
                        .font(.subheadline.weight(.semibold))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    timerText(for: context.state)
                        .font(.system(.headline, design: .rounded).monospacedDigit())
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.isRunning ? "집중 중..." : "일시정지")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Text("🥔")
            } compactTrailing: {
                timerText(for: context.state)
                    .font(.system(.caption2, design: .rounded).monospacedDigit())
            } minimal: {
                Text("🥔")
            }
        }
    }

    @ViewBuilder
    private func timerText(for state: StudyTimerLiveActivityAttributes.ContentState) -> some View {
        if state.isRunning, let startedAt = state.startedAt {
            Text(timerInterval: startedAt...Date.distantFuture, countsDown: false)
        } else {
            Text(formatElapsed(state.elapsedSeconds))
        }
    }

    private func formatElapsed(_ seconds: Int) -> String {
        let safe = max(0, seconds)
        let hours = safe / 3600
        let minutes = (safe % 3600) / 60
        let secs = safe % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, secs)
    }
}
#endif

@main
struct ScheduleWidgetBundle: WidgetBundle {
    var body: some Widget {
        ScheduleWidget()
        WeatherWidget()
        if #available(iOS 16.1, *) {
            StudyTimerLiveActivityWidget()
        }
    }
}
