import Foundation

enum FridgeZone: String, CaseIterable, Identifiable {
    case fridge
    case freezer
    case pantry

    var id: String { rawValue }

    var label: String {
        switch self {
        case .fridge: return "냉장실"
        case .freezer: return "냉동고"
        case .pantry: return "실온"
        }
    }
}

enum FridgeItemStatus: String, CaseIterable, Identifiable {
    case active
    case completed
    case discarded

    var id: String { rawValue }

    var label: String {
        switch self {
        case .active: return "보관중"
        case .completed: return "완료"
        case .discarded: return "폐기"
        }
    }
}

enum FridgeDateHelper {
    private static let ymdFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func todayYmd() -> String {
        ymdFormatter.string(from: Date())
    }

    static func date(from ymd: String) -> Date? {
        ymdFormatter.date(from: ymd)
    }

    static func ymd(from date: Date) -> String {
        ymdFormatter.string(from: date)
    }

    static func calendarDaysUntilExpiry(expiresAt: String?) -> Int? {
        guard let expiresAt, let expiry = date(from: expiresAt) else { return nil }
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let end = calendar.startOfDay(for: expiry)
        return calendar.dateComponents([.day], from: today, to: end).day
    }
}

struct FridgeExpiryDisplay {
    let text: String
    let isUrgent: Bool
    let isExpired: Bool

    static func make(expiresAt: String?) -> FridgeExpiryDisplay {
        guard let expiresAt, !expiresAt.isEmpty else {
            return FridgeExpiryDisplay(text: "기한 없음", isUrgent: false, isExpired: false)
        }
        guard let days = FridgeDateHelper.calendarDaysUntilExpiry(expiresAt: expiresAt) else {
            return FridgeExpiryDisplay(text: expiresAt, isUrgent: false, isExpired: false)
        }
        if days < 0 {
            return FridgeExpiryDisplay(text: "\(expiresAt) (지남)", isUrgent: true, isExpired: true)
        }
        if days <= 3 {
            return FridgeExpiryDisplay(text: "\(expiresAt) (임박)", isUrgent: true, isExpired: false)
        }
        return FridgeExpiryDisplay(text: expiresAt, isUrgent: false, isExpired: false)
    }
}
