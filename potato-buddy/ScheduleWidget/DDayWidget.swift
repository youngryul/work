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

// MARK: - 크레용 손그림 스타일

enum DDayCrayonStyle {
    /// 종이 느낌 배경
    static let paper = Color(red: 1.0, green: 0.992, blue: 0.972)
    /// 크레용 검정 (글씨)
    static let ink = Color(red: 0.16, green: 0.15, blue: 0.14)
    static let subInk = Color(red: 0.45, green: 0.43, blue: 0.40)

    /// 학교안심 보드마커 (앱과 같은 손글씨 폰트)
    static func font(_ size: CGFloat) -> Font {
        .custom("HakgyoansimBoadmarkerR", size: size)
    }
}

/// 크레용으로 슥슥 칠한 듯한 지그재그 빗금 영역
struct CrayonScribble: Shape {
    var spacing: CGFloat = 5

    func path(in rect: CGRect) -> Path {
        var path = Path()
        // 위치마다 고정된 흔들림 (렌더링마다 바뀌지 않도록 결정적인 값 사용)
        let jitter: [CGFloat] = [0, 1.5, -1, 2, -1.5, 0.5, -2, 1]
        var x = rect.minX
        var index = 0
        path.move(to: CGPoint(x: x, y: rect.maxY))
        while x < rect.maxX {
            let wobble = jitter[index % jitter.count]
            let top = CGPoint(x: min(x + spacing, rect.maxX), y: rect.minY + wobble)
            let bottom = CGPoint(x: min(x + spacing * 1.6, rect.maxX), y: rect.maxY - wobble)
            path.addLine(to: top)
            path.addLine(to: bottom)
            x += spacing * 1.6
            index += 1
        }
        return path
    }
}

/// 살짝 삐뚤빼뚤한 크레용 밑줄
struct CrayonUnderline: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        let midY = rect.midY
        path.move(to: CGPoint(x: rect.minX, y: midY + 1))
        path.addCurve(
            to: CGPoint(x: rect.maxX, y: midY - 1),
            control1: CGPoint(x: rect.minX + rect.width * 0.35, y: midY - 3),
            control2: CGPoint(x: rect.minX + rect.width * 0.65, y: midY + 3)
        )
        return path
    }
}

/// 디데이 숫자 뒤에 크레용 칠하기
private struct CrayonHighlight: ViewModifier {
    let color: Color

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, 4)
            .background(alignment: .bottom) {
                ZStack {
                    CrayonScribble(spacing: 5)
                        .stroke(color.opacity(0.32), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    CrayonScribble(spacing: 7)
                        .stroke(color.opacity(0.2), style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
                        .offset(x: 2, y: 1)
                }
                .frame(height: 13)
                .offset(y: -2)
            }
    }
}

/// 가장자리에서 빼꼼 내다보는 포실이
private struct PeekingPosil: View {
    let size: CGFloat
    let rotation: Double

    var body: some View {
        Image("posil-peek")
            .resizable()
            .scaledToFit()
            .frame(width: size)
            .rotationEffect(.degrees(rotation))
            .accessibilityHidden(true)
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

    // 홈 화면 - 작은 위젯: 오른쪽 아래 모서리에서 포실이가 머리만 빼꼼
    private var smallView: some View {
        ZStack(alignment: .topLeading) {
            PeekingPosil(size: 74, rotation: -14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                .offset(x: 26, y: 34)

            VStack(alignment: .leading, spacing: 2) {
                Text(titleText)
                    .font(DDayCrayonStyle.font(15))
                    .foregroundStyle(DDayCrayonStyle.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                CrayonUnderline()
                    .stroke(accent.opacity(0.7), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .frame(width: 44, height: 6)

                if let info {
                    Text(info.label)
                        .font(DDayCrayonStyle.font(38))
                        .foregroundStyle(DDayCrayonStyle.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)
                        .modifier(CrayonHighlight(color: accent))
                        .padding(.top, 6)

                    Spacer(minLength: 0)

                    Text(info.dateText)
                        .font(DDayCrayonStyle.font(11))
                        .foregroundStyle(DDayCrayonStyle.subInk)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                        .padding(.trailing, 46)
                } else {
                    emptyGuide
                        .padding(.top, 10)
                    Spacer(minLength: 0)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    // 홈 화면 - 중간 위젯: 참고 그림처럼 왼쪽 가장자리에서 포실이가 옆으로 빼꼼
    private var mediumView: some View {
        HStack(spacing: 0) {
            PeekingPosil(size: 118, rotation: 90)
                .frame(width: 70)
                .offset(x: -34)

            VStack(alignment: .leading, spacing: 4) {
                Text(titleText)
                    .font(DDayCrayonStyle.font(20))
                    .foregroundStyle(DDayCrayonStyle.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                CrayonUnderline()
                    .stroke(accent.opacity(0.7), style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
                    .frame(width: 60, height: 6)

                Spacer(minLength: 0)

                if let info {
                    HStack(alignment: .lastTextBaseline, spacing: 10) {
                        Text(info.label)
                            .font(DDayCrayonStyle.font(44))
                            .foregroundStyle(DDayCrayonStyle.ink)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .modifier(CrayonHighlight(color: accent))
                        Text(info.caption)
                            .font(DDayCrayonStyle.font(14))
                            .foregroundStyle(accent)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .overlay(
                                Capsule()
                                    .stroke(accent.opacity(0.8), style: StrokeStyle(lineWidth: 2, lineCap: .round, dash: [14, 2]))
                            )
                    }
                    Text(info.dateText)
                        .font(DDayCrayonStyle.font(13))
                        .foregroundStyle(DDayCrayonStyle.subInk)
                        .lineLimit(1)
                } else {
                    emptyGuide
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
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
                    DDayCrayonStyle.paper
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

#Preview(as: .systemMedium) {
    DDayWidget()
} timeline: {
    DDayWidgetEntry(date: .now, configuration: .preview)
}
