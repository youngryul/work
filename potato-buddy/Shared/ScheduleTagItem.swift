import Foundation
import SwiftUI

struct ScheduleTagItem: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let color: String

    var swiftUIColor: Color {
        ScheduleTagColorMapper.color(from: color)
    }
}

enum ScheduleTagColorMapper {
    /// 웹 Tailwind 클래스 문자열을 SwiftUI Color로 매핑
    static func color(from className: String) -> Color {
        let lower = className.lowercased()
        if lower.contains("blue") { return .blue }
        if lower.contains("indigo") { return .indigo }
        if lower.contains("violet") || lower.contains("purple") { return .purple }
        if lower.contains("pink") || lower.contains("rose") { return .pink }
        if lower.contains("orange") { return .orange }
        if lower.contains("amber") || lower.contains("yellow") { return .yellow }
        if lower.contains("lime") || lower.contains("emerald") || lower.contains("green") { return .green }
        if lower.contains("teal") || lower.contains("cyan") { return .cyan }
        if lower.contains("red") { return .red }
        return .gray
    }
}

enum DefaultScheduleTags {
    static let seed: [(name: String, color: String)] = [
        ("업무", "bg-blue-100 text-blue-700 border-blue-200"),
        ("개인", "bg-purple-100 text-purple-700 border-purple-200"),
        ("약속", "bg-emerald-100 text-emerald-700 border-emerald-200"),
        ("가족", "bg-pink-100 text-pink-700 border-pink-200"),
        ("기타", "bg-gray-100 text-gray-700 border-gray-200"),
    ]
}
