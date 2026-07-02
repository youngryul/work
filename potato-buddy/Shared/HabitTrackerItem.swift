import Foundation
import SwiftUI

struct HabitTrackerItem: Codable, Identifiable {
    let id: String
    let year: Int
    let month: Int
    let title: String
    let color: String
    var days: [HabitTrackerDayItem]

    enum CodingKeys: String, CodingKey {
        case id, year, month, title, color, days
    }

    init(
        id: String,
        year: Int,
        month: Int,
        title: String,
        color: String,
        days: [HabitTrackerDayItem] = []
    ) {
        self.id = id
        self.year = year
        self.month = month
        self.title = title
        self.color = color
        self.days = days
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        year = try container.decode(Int.self, forKey: .year)
        month = try container.decode(Int.self, forKey: .month)
        title = try container.decode(String.self, forKey: .title)
        color = try container.decode(String.self, forKey: .color)
        days = try container.decodeIfPresent([HabitTrackerDayItem].self, forKey: .days) ?? []
    }

    var accentColor: Color {
        Color(hex: color)
    }

    func isDayCompleted(_ day: Int) -> Bool {
        days.first(where: { $0.day == day })?.isCompleted ?? false
    }

    var completedCount: Int {
        days.filter(\.isCompleted).count
    }

    func completionRate(totalDays: Int) -> Int {
        guard totalDays > 0 else { return 0 }
        return Int(round(Double(completedCount) / Double(totalDays) * 100))
    }
}

struct HabitTrackerDayItem: Codable, Identifiable {
    let id: String
    let habitTrackerId: String
    let day: Int
    let isCompleted: Bool

    enum CodingKeys: String, CodingKey {
        case id, day
        case habitTrackerId = "habit_tracker_id"
        case isCompleted = "is_completed"
    }
}

enum HabitTrackerColorOption: String, CaseIterable, Identifiable {
    case pink = "#FFB6C1"
    case purple = "#DDA0DD"
    case salmon = "#FFA07A"
    case sky = "#87CEEB"
    case yellow = "#F0E68C"
    case green = "#98FB98"
    case peach = "#FFB347"

    var id: String { rawValue }

    var color: Color {
        Color(hex: rawValue)
    }
}

enum HabitTrackerDateHelper {
    static func daysInMonth(year: Int, month: Int) -> Int {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        let calendar = Calendar(identifier: .gregorian)
        guard let date = calendar.date(from: components),
              let range = calendar.range(of: .day, in: .month, for: date)
        else { return 30 }
        return range.count
    }

    static func gridRows(totalDays: Int) -> [[Int]] {
        let daysPerRow = 7
        var rows: [[Int]] = []
        var currentDay = 1

        while currentDay <= totalDays {
            var row: [Int] = []
            for _ in 0..<daysPerRow where currentDay <= totalDays {
                row.append(currentDay)
                currentDay += 1
            }
            while row.count < daysPerRow {
                row.append(0)
            }
            rows.append(row)
        }

        return rows
    }
}

extension Color {
    init(hex: String) {
        let sanitized = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var value: UInt64 = 0
        Scanner(string: sanitized).scanHexInt64(&value)

        let red: Double
        let green: Double
        let blue: Double

        switch sanitized.count {
        case 6:
            red = Double((value >> 16) & 0xFF) / 255
            green = Double((value >> 8) & 0xFF) / 255
            blue = Double(value & 0xFF) / 255
        default:
            red = 1
            green = 0.71
            blue = 0.76
        }

        self.init(.sRGB, red: red, green: green, blue: blue)
    }
}
