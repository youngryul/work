import Foundation
import SwiftUI
#if canImport(WidgetKit)
import WidgetKit
#endif

/// 디데이 색상
enum DDayAccent: String, CaseIterable, Identifiable {
    case orange, pink, blue, green, purple

    var id: String { rawValue }

    var label: String {
        switch self {
        case .orange: return "오렌지"
        case .pink: return "핑크"
        case .blue: return "블루"
        case .green: return "그린"
        case .purple: return "퍼플"
        }
    }

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

/// 디데이 한 건 (앱에서 달력으로 만들고, 위젯에서 골라 표시)
struct DDayEvent: Codable, Identifiable, Hashable {
    var id: String
    var title: String
    /// 날짜 (YYYY-MM-DD, 기기 시간대 기준)
    var dateString: String
    /// 기념일처럼 시작일을 1일째로 세는 방식 (예: 사귄 날 = D+1)
    var countStartAsDayOne: Bool
    /// 색상 키 (orange, pink, blue, green, purple)
    var accent: String

    init(
        id: String = UUID().uuidString,
        title: String,
        date: Date,
        countStartAsDayOne: Bool = false,
        accent: String = "orange"
    ) {
        self.id = id
        self.title = title
        self.dateString = DDayEvent.formatter.string(from: date)
        self.countStartAsDayOne = countStartAsDayOne
        self.accent = accent
    }

    /// 날짜를 Date로 (해당 날 00:00)
    var date: Date {
        get { DDayEvent.formatter.date(from: dateString) ?? Date() }
        set { dateString = DDayEvent.formatter.string(from: newValue) }
    }

    var accentColor: Color {
        (DDayAccent(rawValue: accent) ?? .orange).color
    }

    var displayTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "디데이" : trimmed
    }

    private static let formatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

/// 디데이 계산 결과
struct DDayInfo {
    /// 예: "D-12", "D-Day", "D+100"
    let label: String
    /// 예: "12일 남음", "오늘!", "100일째"
    let caption: String
    /// 예: "2026.10.24 (토)"
    let dateText: String

    init(event: DDayEvent, from now: Date) {
        let calendar = Calendar.current
        let target = event.date
        let start = calendar.startOfDay(for: now)
        let end = calendar.startOfDay(for: target)
        let diff = calendar.dateComponents([.day], from: start, to: end).day ?? 0

        if event.countStartAsDayOne && diff <= 0 {
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

/// 디데이 목록 저장소 (앱 그룹 UserDefaults — 앱과 위젯이 함께 사용)
enum DDayStore {
    static let widgetKind = "DDayWidget"
    private static let eventsKey = "widget.dday.events.v1"

    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: "group.com.youngryul.potatobuddy.ios")
    }

    static func loadAll() -> [DDayEvent] {
        guard let data = defaults?.data(forKey: eventsKey),
              let events = try? JSONDecoder().decode([DDayEvent].self, from: data) else {
            return []
        }
        return events
    }

    static func event(id: String) -> DDayEvent? {
        loadAll().first { $0.id == id }
    }

    /// 같은 id가 있으면 수정, 없으면 추가
    static func upsert(_ event: DDayEvent) {
        var events = loadAll()
        if let index = events.firstIndex(where: { $0.id == event.id }) {
            events[index] = event
        } else {
            events.append(event)
        }
        save(events)
    }

    static func delete(id: String) {
        save(loadAll().filter { $0.id != id })
    }

    private static func save(_ events: [DDayEvent]) {
        guard let data = try? JSONEncoder().encode(events) else { return }
        defaults?.set(data, forKey: eventsKey)
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        #endif
    }
}
