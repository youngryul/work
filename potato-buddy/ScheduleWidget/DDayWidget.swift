import WidgetKit
import SwiftUI
import AppIntents

// MARK: - 위젯 설정 (앱의 디데이 목록 중 하나를 선택)

/// 앱에서 만든 디데이 (위젯 편집 화면의 선택 항목)
struct DDayEventEntity: AppEntity {
    let id: String
    let title: String
    let dateText: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "디데이"
    static var defaultQuery = DDayEventQuery()

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(title)", subtitle: "\(dateText)")
    }

    init(event: DDayEvent) {
        id = event.id
        title = event.displayTitle
        dateText = DDayInfo(event: event, from: Date()).dateText
    }
}

struct DDayEventQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [DDayEventEntity] {
        DDayStore.loadAll()
            .filter { identifiers.contains($0.id) }
            .map(DDayEventEntity.init)
    }

    func suggestedEntities() async throws -> [DDayEventEntity] {
        DDayStore.loadAll().map(DDayEventEntity.init)
    }

    /// 새로 추가한 위젯은 첫 번째 디데이를 기본으로 표시
    func defaultResult() async -> DDayEventEntity? {
        DDayStore.loadAll().first.map(DDayEventEntity.init)
    }
}

struct DDayConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "디데이"
    static var description = IntentDescription("포실이 앱 > 더보기 > 디데이에서 만든 디데이 중 표시할 항목을 고릅니다.")

    @Parameter(title: "디데이")
    var event: DDayEventEntity?
}

// MARK: - 타임라인

struct DDayWidgetEntry: TimelineEntry {
    let date: Date
    /// 표시할 디데이 (없으면 앱에서 만들라는 안내 표시)
    let event: DDayEvent?
}

struct DDayWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DDayWidgetEntry {
        DDayWidgetEntry(date: Date(), event: .preview)
    }

    func snapshot(for configuration: DDayConfigurationIntent, in context: Context) async -> DDayWidgetEntry {
        let event = resolveEvent(configuration)
        return DDayWidgetEntry(date: Date(), event: event ?? (context.isPreview ? .preview : nil))
    }

    func timeline(for configuration: DDayConfigurationIntent, in context: Context) async -> Timeline<DDayWidgetEntry> {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let event = resolveEvent(configuration)

        // 지금 + 앞으로 7일치 자정 엔트리를 미리 만들어 날짜가 바뀌면 바로 갱신되도록 함
        var entries = [DDayWidgetEntry(date: Date(), event: event)]
        for offset in 1...7 {
            if let midnight = calendar.date(byAdding: .day, value: offset, to: today) {
                entries.append(DDayWidgetEntry(date: midnight, event: event))
            }
        }
        return Timeline(entries: entries, policy: .atEnd)
    }

    /// 앱에서 수정한 최신 내용을 반영하기 위해 저장소에서 다시 읽는다.
    /// 선택한 디데이가 삭제됐거나 선택 전이면 첫 번째 디데이를 표시한다.
    private func resolveEvent(_ configuration: DDayConfigurationIntent) -> DDayEvent? {
        if let id = configuration.event?.id, let event = DDayStore.event(id: id) {
            return event
        }
        return DDayStore.loadAll().first
    }
}

extension DDayEvent {
    static var preview: DDayEvent {
        DDayEvent(
            title: "여행 가는 날",
            date: Calendar.current.date(byAdding: .day, value: 12, to: Date()) ?? Date()
        )
    }
}

// MARK: - 뷰

struct DDayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DDayWidgetEntry

    private var accent: Color { entry.event?.accentColor ?? .orange }
    private var titleText: String { entry.event?.displayTitle ?? "디데이" }
    private var info: DDayInfo? {
        entry.event.map { DDayInfo(event: $0, from: entry.date) }
    }

    var body: some View {
        switch family {
        case .accessoryCircular: circularView
        case .accessoryRectangular: rectangularView
        case .accessoryInline: inlineView
        case .systemMedium: mediumView
        default: smallView
        }
    }

    // 홈 화면 - 작은 위젯
    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(titleText)
                .font(.system(.subheadline, design: .rounded).weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(2)

            Spacer(minLength: 0)

            if let info {
                Text(info.label)
                    .font(.system(size: 36, weight: .heavy, design: .rounded))
                    .foregroundStyle(accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                Text(info.dateText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            } else {
                emptyGuide
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // 홈 화면 - 중간 위젯
    private var mediumView: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 6) {
                Text(titleText)
                    .font(.system(.title3, design: .rounded).weight(.bold))
                    .lineLimit(2)
                if let info {
                    Text(info.dateText)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(info.caption)
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(accent.opacity(0.15), in: Capsule())
                        .foregroundStyle(accent)
                } else {
                    emptyGuide
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let info {
                Text(info.label)
                    .font(.system(size: 44, weight: .heavy, design: .rounded))
                    .foregroundStyle(accent)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    // 잠금 화면 - 원형
    private var circularView: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Text(titleText)
                    .font(.system(size: 9, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                Text(info?.label ?? "D-?")
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
            }
            .padding(4)
        }
    }

    // 잠금 화면 - 사각형
    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(titleText)
                .font(.headline)
                .lineLimit(1)
            Text(info?.label ?? "앱에서 디데이 추가")
                .font(.system(.title3, design: .rounded).weight(.heavy))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            if let info {
                Text(info.dateText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // 잠금 화면 - 시계 위 한 줄
    private var inlineView: some View {
        Text("\(titleText) \(info?.label ?? "")")
    }

    private var emptyGuide: some View {
        Text("포실이 앱 더보기 >\n디데이에서 추가하세요")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .lineLimit(2)
            .minimumScaleFactor(0.8)
    }
}

// MARK: - 위젯

struct DDayWidget: Widget {
    let kind: String = "DDayWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: DDayConfigurationIntent.self, provider: DDayWidgetProvider()) { entry in
            DDayWidgetView(entry: entry)
                .containerBackground(for: .widget) {
                    Color(.systemBackground)
                }
        }
        .configurationDisplayName("디데이")
        .description("중요한 날까지 남은 날, 혹은 지난 날을 보여줍니다.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

#Preview(as: .systemSmall) {
    DDayWidget()
} timeline: {
    DDayWidgetEntry(date: .now, event: .preview)
}
