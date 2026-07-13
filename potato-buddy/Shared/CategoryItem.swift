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
}
