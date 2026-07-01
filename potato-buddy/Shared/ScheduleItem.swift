import Foundation
import SwiftUI

struct ScheduleItem: Codable, Identifiable {
    let id: String
    let scheduleDate: String
    let endDate: String?
    let title: String
    let tag: String

    enum CodingKeys: String, CodingKey {
        case id, title, tag
        case scheduleDate = "schedule_date"
        case endDate = "end_date"
    }

    var resolvedEndDate: String {
        endDate ?? scheduleDate
    }

    var isMultiDay: Bool {
        resolvedEndDate != scheduleDate
    }

    func contains(date: String) -> Bool {
        date >= scheduleDate && date <= resolvedEndDate
    }
}

enum ScheduleTagOption: String, CaseIterable, Identifiable {
    case work = "업무"
    case personal = "개인"
    case appointment = "약속"
    case family = "가족"
    case other = "기타"

    var id: String { rawValue }

    var color: Color {
        switch self {
        case .work: return .blue
        case .personal: return .purple
        case .appointment: return .green
        case .family: return .pink
        case .other: return .gray
        }
    }

    var backgroundColor: Color {
        color.opacity(0.15)
    }
}

enum ScheduleDateHelper {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    static func monthRange(year: Int, month: Int) -> (start: String, end: String) {
        var startComponents = DateComponents()
        startComponents.year = year
        startComponents.month = month
        startComponents.day = 1

        let calendar = Calendar(identifier: .gregorian)
        guard let startDate = calendar.date(from: startComponents),
              let endDate = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startDate)
        else {
            return ("", "")
        }

        return (
            dayFormatter.string(from: startDate),
            dayFormatter.string(from: endDate)
        )
    }

    static func todayString() -> String {
        dayFormatter.string(from: Date())
    }
}
