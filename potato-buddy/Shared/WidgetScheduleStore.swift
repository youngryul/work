import Foundation

enum WidgetScheduleConstants {
    static let appGroupId = "group.com.youngryul.potatobuddy.ios"
    static let widgetKind = "ScheduleWidget"
    static let snapshotKey = "widget.schedule.snapshot"
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

    static func save(_ snapshot: WidgetScheduleSnapshot) {
        guard let defaults else { return }
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(snapshot) else { return }
        defaults.set(data, forKey: WidgetScheduleConstants.snapshotKey)
    }

    static func load() -> WidgetScheduleSnapshot? {
        guard
            let defaults,
            let data = defaults.data(forKey: WidgetScheduleConstants.snapshotKey)
        else {
            return nil
        }

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
        dayFormatter.string(from: Date())
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
