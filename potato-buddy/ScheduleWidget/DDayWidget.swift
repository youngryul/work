import WidgetKit
import SwiftUI
import AppIntents

// MARK: - 위젯 설정 (위젯 길게 눌러 '위젯 편집'에서 입력)

enum DDayAccentColor: String, AppEnum {
    case orange, pink, blue, green, purple

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "색상"
    static var caseDisplayRepresentations: [DDayAccentColor: DisplayRepresentation] = [
        .orange: "오렌지",
        .pink: "핑크",
        .blue: "블루",
        .green: "그린",
        .purple: "퍼플",
    ]

    var color: Color {
        switch self {
        case .orange: return .orange
        case .pink: return .pink
        case .blue: return .blue
        case .green: return .green
        case .purple: return .purple
        }
    }
}

struct DDayConfigurationIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "디데이"
    static var description = IntentDescription("디데이로 표시할 이름과 날짜를 설정합니다.")

    @Parameter(title: "이름", default: "디데이")
    var title: String

    @Parameter(title: "날짜")
    var targetDate: Date?

    /// 기념일처럼 시작일을 1일째로 세는 방식 (예: 사귄 날 = D+1)
    @Parameter(title: "시작일을 1일로 세기", default: false)
    var countStartAsDayOne: Bool

    @Parameter(title: "색상", default: .orange)
    var accent: DDayAccentColor
}

// MARK: - 타임라인

struct DDayWidgetEntry: TimelineEntry {
    let date: Date
    let configuration: DDayConfigurationIntent
}

struct DDayWidgetProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> DDayWidgetEntry {
        DDayWidgetEntry(date: Date(), configuration: .preview)
    }

    func snapshot(for configuration: DDayConfigurationIntent, in context: Context) async -> DDayWidgetEntry {
        let config = (context.isPreview && configuration.targetDate == nil) ? .preview : configuration
        return DDayWidgetEntry(date: Date(), configuration: config)
    }

    func timeline(for configuration: DDayConfigurationIntent, in context: Context) async -> Timeline<DDayWidgetEntry> {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        // 지금 + 앞으로 7일치 자정 엔트리를 미리 만들어 날짜가 바뀌면 바로 갱신되도록 함
        var entries = [DDayWidgetEntry(date: Date(), configuration: configuration)]
        for offset in 1...7 {
            if let midnight = calendar.date(byAdding: .day, value: offset, to: today) {
                entries.append(DDayWidgetEntry(date: midnight, configuration: configuration))
            }
        }
        return Timeline(entries: entries, policy: .atEnd)
    }
}

extension DDayConfigurationIntent {
    static var preview: DDayConfigurationIntent {
        let intent = DDayConfigurationIntent()
        intent.title = "여행 가는 날"
        intent.targetDate = Calendar.current.date(byAdding: .day, value: 12, to: Date())
        intent.accent = .orange
        return intent
    }
}

// MARK: - 디데이 계산

struct DDayInfo {
    /// 예: "D-12", "D-Day", "D+100"
    let label: String
    /// 예: "12일 남음", "오늘!", "100일째"
    let caption: String
    let dateText: String

    init?(target: Date?, from now: Date, countStartAsDayOne: Bool) {
        guard let target else { return nil }
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: now)
        let end = calendar.startOfDay(for: target)
        let diff = calendar.dateComponents([.day], from: start, to: end).day ?? 0

        if countStartAsDayOne && diff <= 0 {
            // 기념일 모드: 시작일이 1일째
            let dayCount = -diff + 1
            label = "D+\(dayCount)"
            caption = "\(dayCount)일째"
        } else if diff > 0 {
            label = "D-\(diff)"
            caption = "\(diff)일 남음"
        } else if diff == 0 {
            label = "D-Day"
            caption = "오늘!"
        } else {
            label = "D+\(-diff)"
            caption = "\(-diff)일 지남"
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy.M.d (E)"
        dateText = formatter.string(from: target)
    }
}

// MARK: - 뷰

struct DDayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DDayWidgetEntry

    private var config: DDayConfigurationIntent { entry.configuration }
    private var accent: Color { config.accent.color }
    private var titleText: String {
        let trimmed = config.title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "디데이" : trimmed
    }
    private var info: DDayInfo? {
        DDayInfo(target: config.targetDate, from: entry.date, countStartAsDayOne: config.countStartAsDayOne)
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
            Text(info?.label ?? "날짜를 설정하세요")
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
        Text("위젯을 길게 눌러\n날짜를 설정하세요")
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
    DDayWidgetEntry(date: .now, configuration: .preview)
}
