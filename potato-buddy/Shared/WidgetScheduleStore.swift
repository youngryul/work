import Foundation

enum WidgetScheduleConstants {
    static let appGroupId = "group.com.youngryul.potatobuddy.ios"
    static let widgetKind = "ScheduleWidget"
    static let snapshotKey = "widget.schedule.snapshot"
    static let snapshotDictKey = "widget.schedule.snapshots.v2"
}

struct WidgetScheduleEntryItem: Codable, Identifiable {
    let id: String
    let title: String
    let tag: String
}

struct WidgetScheduleSnapshot: Codable {
    let dateString: String
    let dateLabel: String
    let items: [WidgetScheduleEntryItem]
    let updatedAt: Date

    static let empty = WidgetScheduleSnapshot(
        dateString: "",
        dateLabel: "오늘",
        items: [],
        updatedAt: .distantPast
    )
}

enum WidgetScheduleStore {
    private static var defaults: UserDefaults? {
        UserDefaults(suiteName: WidgetScheduleConstants.appGroupId)
    }

    // MARK: - 날짜별 스냅샷 (새 API)

    /// 특정 날짜(YYYY-MM-DD)의 스냅샷을 저장합니다.
    static func save(_ snapshot: WidgetScheduleSnapshot, forDate dateString: String) {
        var dict = loadAll()
        dict[dateString] = snapshot
        // 7일 이상 지난 항목 정리
        let cutoff = WidgetScheduleDateFormatter.string(
            from: Date().addingTimeInterval(-7 * 86400)
        )
        dict = dict.filter { $0.key >= cutoff }
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(dict) {
            defaults.set(data, forKey: WidgetScheduleConstants.snapshotDictKey)
        }
    }

    /// 특정 날짜(YYYY-MM-DD)의 스냅샷을 불러옵니다.
    static func load(forDate dateString: String) -> WidgetScheduleSnapshot? {
        loadAll()[dateString]
    }

    private static func loadAll() -> [String: WidgetScheduleSnapshot] {
        guard let defaults,
              let data = defaults.data(forKey: WidgetScheduleConstants.snapshotDictKey)
        else { return [:] }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([String: WidgetScheduleSnapshot].self, from: data)) ?? [:]
    }

    static func clearAll() {
        defaults?.removeObject(forKey: WidgetScheduleConstants.snapshotDictKey)
        defaults?.removeObject(forKey: WidgetScheduleConstants.snapshotKey)
    }

    // MARK: - 레거시 단일 스냅샷 (하위 호환)

    static func save(_ snapshot: WidgetScheduleSnapshot) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: WidgetScheduleConstants.snapshotKey)
    }

    static func load() -> WidgetScheduleSnapshot? {
        guard let defaults,
              let data = defaults.data(forKey: WidgetScheduleConstants.snapshotKey)
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try? decoder.decode(WidgetScheduleSnapshot.self, from: data)
    }

    static func clear() {
        defaults?.removeObject(forKey: WidgetScheduleConstants.snapshotKey)
    }
}

enum WidgetScheduleDateFormatter {
    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    static func todayString() -> String {
        string(from: Date())
    }

    static func string(from date: Date) -> String {
        dayFormatter.string(from: date)
    }

    static func label(for dateString: String) -> String {
        guard let date = dayFormatter.date(from: dateString) else {
            return dateString
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "M월 d일 (E)"
        formatter.locale = Locale(identifier: "ko_KR")
        return formatter.string(from: date)
    }
}
