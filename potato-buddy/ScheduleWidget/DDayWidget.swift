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
        // 크레용 느낌의 부드러운 색
        case .orange: return Color(red: 0.95, green: 0.58, blue: 0.25)
        case .pink: return Color(red: 0.94, green: 0.48, blue: 0.64)
        case .blue: return Color(red: 0.22, green: 0.40, blue: 0.80)
        case .green: return Color(red: 0.49, green: 0.76, blue: 0.33)
        case .purple: return Color(red: 0.58, green: 0.46, blue: 0.82)
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
            .font(DDayCrayonStyle.font(12))
            .foregroundStyle(DDayCrayonStyle.subInk)
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
    DDayWidgetEntry(date: .now, configuration: .preview)
}

#Preview(as: .systemMedium) {
    DDayWidget()
} timeline: {
    DDayWidgetEntry(date: .now, configuration: .preview)
}
