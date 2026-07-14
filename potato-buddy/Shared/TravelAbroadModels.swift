import Foundation

struct AbroadTrip: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let countryCode: String
    let departureAt: String
    let returnAt: String

    enum CodingKeys: String, CodingKey {
        case id, title
        case countryCode = "country_code"
        case departureAt = "departure_at"
        case returnAt = "return_at"
    }

    var countryName: String {
        TravelAbroadCountry.name(for: countryCode)
    }

    var timeZoneIdentifier: String {
        TravelAbroadCountry.meta(for: countryCode).timeZone
    }
}

struct AbroadItineraryItem: Codable, Identifiable, Hashable {
    let id: String
    let tripId: String
    let itemDate: String
    let startMinute: Int
    let endMinute: Int
    let title: String
    let memo: String?

    enum CodingKeys: String, CodingKey {
        case id, title, memo
        case tripId = "trip_id"
        case itemDate = "item_date"
        case startMinute = "start_minute"
        case endMinute = "end_minute"
    }

    var startLabel: String { TravelItineraryTime.minuteToLabel(startMinute) }
    var endLabel: String { TravelItineraryTime.minuteToLabel(endMinute) }
}

struct AbroadPackingItem: Codable, Identifiable, Hashable {
    let id: String
    let tripId: String
    let title: String
    let isChecked: Bool
    let sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id, title
        case tripId = "trip_id"
        case isChecked = "is_checked"
        case sortOrder = "sort_order"
    }
}

struct AbroadSouvenirItem: Codable, Identifiable, Hashable {
    let id: String
    let tripId: String
    let title: String
    let isChecked: Bool
    let sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id, title
        case tripId = "trip_id"
        case isChecked = "is_checked"
        case sortOrder = "sort_order"
    }
}

struct AbroadSpareItem: Codable, Identifiable, Hashable {
    let id: String
    let tripId: String
    let title: String
    let sortOrder: Int?

    enum CodingKeys: String, CodingKey {
        case id, title
        case tripId = "trip_id"
        case sortOrder = "sort_order"
    }
}

struct TravelAbroadCountry: Identifiable, Hashable {
    let code: String
    let name: String
    var id: String { code }

    struct Meta {
        let timeZone: String
        let currencyCode: String?
        let currencyLabel: String?
    }

    static let options: [TravelAbroadCountry] = [
        .init(code: "JP", name: "일본"),
        .init(code: "VN", name: "베트남"),
        .init(code: "TH", name: "태국"),
        .init(code: "TW", name: "대만"),
        .init(code: "CN", name: "중국"),
        .init(code: "HK", name: "홍콩"),
        .init(code: "SG", name: "싱가포르"),
        .init(code: "US", name: "미국"),
        .init(code: "GB", name: "영국"),
        .init(code: "FR", name: "프랑스"),
        .init(code: "DE", name: "독일"),
        .init(code: "IT", name: "이탈리아"),
        .init(code: "ES", name: "스페인"),
        .init(code: "AU", name: "호주"),
        .init(code: "PH", name: "필리핀"),
        .init(code: "MY", name: "말레이시아"),
        .init(code: "ID", name: "인도네시아"),
        .init(code: "AE", name: "아랍에미리트"),
        .init(code: "CA", name: "캐나다"),
        .init(code: "NL", name: "네덜란드"),
    ].sorted { $0.name < $1.name }

    static func name(for code: String) -> String {
        options.first(where: { $0.code == code.uppercased() })?.name ?? code
    }

    static func meta(for code: String) -> Meta {
        let upper = code.uppercased()
        switch upper {
        case "JP": return Meta(timeZone: "Asia/Tokyo", currencyCode: "JPY", currencyLabel: "엔")
        case "VN": return Meta(timeZone: "Asia/Ho_Chi_Minh", currencyCode: "VND", currencyLabel: "동")
        case "TH": return Meta(timeZone: "Asia/Bangkok", currencyCode: "THB", currencyLabel: "바트")
        case "TW": return Meta(timeZone: "Asia/Taipei", currencyCode: "TWD", currencyLabel: "대만달러")
        case "CN": return Meta(timeZone: "Asia/Shanghai", currencyCode: "CNY", currencyLabel: "위안")
        case "HK": return Meta(timeZone: "Asia/Hong_Kong", currencyCode: "HKD", currencyLabel: "홍콩달러")
        case "SG": return Meta(timeZone: "Asia/Singapore", currencyCode: "SGD", currencyLabel: "싱가포르달러")
        case "US": return Meta(timeZone: "America/New_York", currencyCode: "USD", currencyLabel: "달러")
        case "GB": return Meta(timeZone: "Europe/London", currencyCode: "GBP", currencyLabel: "파운드")
        case "FR": return Meta(timeZone: "Europe/Paris", currencyCode: "EUR", currencyLabel: "유로")
        case "DE": return Meta(timeZone: "Europe/Berlin", currencyCode: "EUR", currencyLabel: "유로")
        case "IT": return Meta(timeZone: "Europe/Rome", currencyCode: "EUR", currencyLabel: "유로")
        case "ES": return Meta(timeZone: "Europe/Madrid", currencyCode: "EUR", currencyLabel: "유로")
        case "NL": return Meta(timeZone: "Europe/Amsterdam", currencyCode: "EUR", currencyLabel: "유로")
        case "AU": return Meta(timeZone: "Australia/Sydney", currencyCode: "AUD", currencyLabel: "호주달러")
        case "PH": return Meta(timeZone: "Asia/Manila", currencyCode: "PHP", currencyLabel: "페소")
        case "MY": return Meta(timeZone: "Asia/Kuala_Lumpur", currencyCode: "MYR", currencyLabel: "링깃")
        case "ID": return Meta(timeZone: "Asia/Jakarta", currencyCode: "IDR", currencyLabel: "루피아")
        case "AE": return Meta(timeZone: "Asia/Dubai", currencyCode: "AED", currencyLabel: "디르함")
        case "CA": return Meta(timeZone: "America/Toronto", currencyCode: "CAD", currencyLabel: "캐나다달러")
        default: return Meta(timeZone: "UTC", currencyCode: nil, currencyLabel: nil)
        }
    }
}

enum TravelItineraryTime {
    static func minuteToLabel(_ minute: Int) -> String {
        let clamped = max(0, min(1440, minute))
        if clamped == 1440 { return "24:00" }
        let h = clamped / 60
        let m = clamped % 60
        return String(format: "%02d:%02d", h, m)
    }

    static func labelToMinute(_ label: String) -> Int {
        let parts = label.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return 0 }
        return parts[0] * 60 + parts[1]
    }

    static let halfHourOptions: [Int] = Array(stride(from: 0, through: 1440, by: 30))

    static func dateKeys(from departureISO: String, to returnISO: String) -> [String] {
        let start = dateKey(from: departureISO)
        let end = dateKey(from: returnISO)
        guard !start.isEmpty, !end.isEmpty, end >= start else { return [] }

        var result: [String] = []
        var cursor = Calendar.current.date(from: DateComponents(
            year: Int(start.prefix(4)),
            month: Int(start.dropFirst(5).prefix(2)),
            day: Int(start.suffix(2))
        )) ?? Date()
        let last = Calendar.current.date(from: DateComponents(
            year: Int(end.prefix(4)),
            month: Int(end.dropFirst(5).prefix(2)),
            day: Int(end.suffix(2))
        )) ?? cursor

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")

        while cursor <= last {
            result.append(formatter.string(from: cursor))
            guard let next = Calendar.current.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return result
    }

    static func dateKey(from isoOrDate: String) -> String {
        if isoOrDate.count >= 10, isoOrDate.contains("-") {
            return String(isoOrDate.prefix(10))
        }
        return ""
    }

    static func formatDateTime(_ iso: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = formatter.date(from: iso)
        if date == nil {
            formatter.formatOptions = [.withInternetDateTime]
            date = formatter.date(from: iso)
        }
        guard let date else { return dateKey(from: iso) }
        let out = DateFormatter()
        out.locale = Locale(identifier: "ko_KR")
        out.dateFormat = "yyyy. MM. dd. HH:mm"
        return out.string(from: date)
    }
}
