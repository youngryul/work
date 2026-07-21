import Foundation

struct TaskItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let category: String?
    let priority: Int?
    /// epoch milliseconds
    let createdat: Int64?

    enum CodingKeys: String, CodingKey {
        case id, title, category, priority, createdat
    }

    /// 카테고리가 있으면 [카테고리] 접두사 포함
    var displayTitle: String {
        if let cat = category, cat != "작업", !cat.isEmpty {
            return "[\(cat)] \(title)"
        }
        return title
    }

    /// 생성 후 경과 일수
    var ageDays: Int {
        guard let createdat else { return 0 }
        let created = Date(timeIntervalSince1970: TimeInterval(createdat) / 1000)
        let days = Calendar.current.dateComponents([.day], from: created, to: Date()).day ?? 0
        return max(0, days)
    }

    var isStaleOneWeek: Bool { ageDays >= 7 }
    var isStaleTwoWeeks: Bool { ageDays >= 14 }
}
