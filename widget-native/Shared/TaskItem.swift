import Foundation

struct TaskItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let category: String?
    let priority: Int?

    /// 카테고리가 있으면 [카테고리] 접두사 포함
    var displayTitle: String {
        if let cat = category, cat != "작업", !cat.isEmpty {
            return "[\(cat)] \(title)"
        }
        return title
    }
}