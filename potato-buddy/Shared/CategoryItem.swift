import Foundation
import SwiftUI

struct CategoryItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let emoji: String?

    var displayName: String {
        if let emoji, !emoji.isEmpty {
            return "\(emoji) \(name)"
        }
        return name
    }
}

enum CategoryConstants {
    static let systemDailyName = "일상"
    static let systemDailyEmoji = "🌅"
    static let fallbackDefaultName = "회사"

    static let defaultSeed: [(name: String, emoji: String)] = [
        ("회사", "🏢"),
        ("부업", "💰"),
        ("집안일", "🧹"),
        ("프로젝트", "💻"),
        ("운동", "💪"),
        ("공부", "📚"),
    ]

    /// 네트워크 실패 시 백로그 등에서 사용하는 로컬 폴백 목록
    static func localFallbackList() -> [CategoryItem] {
        var list = defaultSeed.enumerated().map { index, cat in
            CategoryItem(id: "local-\(index)", name: cat.name, emoji: cat.emoji)
        }
        list.insert(
            CategoryItem(
                id: "system_daily",
                name: systemDailyName,
                emoji: systemDailyEmoji
            ),
            at: 0
        )
        return list
    }

    /// 웹 `getCategoryEmoji`와 동일한 폴백 규칙
    static func emoji(for categoryName: String?, in categories: [CategoryItem]) -> String {
        guard let categoryName, !categoryName.isEmpty else { return "📝" }
        if categoryName == systemDailyName { return systemDailyEmoji }
        if let match = categories.first(where: { $0.name == categoryName }),
           let emoji = match.emoji, !emoji.isEmpty {
            return emoji
        }
        if let seed = defaultSeed.first(where: { $0.name == categoryName }) {
            return seed.emoji
        }
        return "📝"
    }
}
