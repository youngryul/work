import Foundation
import SwiftUI

enum ScheduleRepeatType: String, CaseIterable, Identifiable, Codable {
    case none = "none"
    case weekly = "weekly"
    case monthly = "monthly"
    case yearly = "yearly"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .none: return "반복 없음"
        case .weekly: return "매주"
        case .monthly: return "매월"
        case .yearly: return "매년"
        }
    }

    static func normalize(_ raw: String?) -> ScheduleRepeatType {
        guard let raw, let value = ScheduleRepeatType(rawValue: raw) else {
            return .none
        }
        return value
    }
}

enum ScheduleRepeatEndType: String, CaseIterable, Identifiable, Codable {
    case never = "never"
    case count = "count"
    case until = "until"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .never: return "종료일 없음"
        case .count: return "반복 횟수"
        case .until: return "종료일"
        }
    }

    static func normalize(_ raw: String?) -> ScheduleRepeatEndType {
        guard let raw, let value = ScheduleRepeatEndType(rawValue: raw) else {
            return .never
        }
        return value
    }
}

enum ScheduleMonthlyRule: String, CaseIterable, Identifiable, Codable {
    case day = "day"
    case nthWeekday = "nth_weekday"
    case lastWeekday = "last_weekday"
    case lastDay = "last_day"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .day: return "매월 같은 날짜"
        case .nthWeekday: return "매월 N번째 요일"
        case .lastWeekday: return "매월 마지막 요일"
        case .lastDay: return "매월 말일"
        }
    }

    static func normalize(_ raw: String?) -> ScheduleMonthlyRule {
        guard let raw, let value = ScheduleMonthlyRule(rawValue: raw) else {
            return .day
        }
        return value
    }
}

/// JS getDay()와 동일: 0=일 … 6=토
struct ScheduleWeekdayOption: Identifiable {
    let id: Int
    let label: String

    static let all: [ScheduleWeekdayOption] = [
        .init(id: 1, label: "월"),
        .init(id: 2, label: "화"),
        .init(id: 3, label: "수"),
        .init(id: 4, label: "목"),
        .init(id: 5, label: "금"),
        .init(id: 6, label: "토"),
        .init(id: 0, label: "일"),
    ]

    static func label(for id: Int) -> String {
        all.first(where: { $0.id == id })?.label ?? ""
    }
}

struct ScheduleItem: Codable, Identifiable {
    let id: String
    let scheduleDate: String
    let endDate: String?
    let title: String
    let tag: String
    let repeatType: String?
    let repeatInterval: Int?
    let repeatWeekdays: String?
    let repeatMonthlyRule: String?
    let repeatMonthDay: Int?
    let repeatNth: Int?
    let repeatWeekday: Int?
    let repeatEndType: String?
    let repeatCount: Int?
    let repeatUntil: String?
    /// 펼쳐진 발생분의 원본(시리즈) ID. decode 시에는 없음.
    var seriesId: String?
    var seriesStartDate: String?
    var isOccurrence: Bool

    enum CodingKeys: String, CodingKey {
        case id, title, tag
        case scheduleDate = "schedule_date"
        case endDate = "end_date"
        case repeatType = "repeat_type"
        case repeatInterval = "repeat_interval"
        case repeatWeekdays = "repeat_weekdays"
        case repeatMonthlyRule = "repeat_monthly_rule"
        case repeatMonthDay = "repeat_month_day"
        case repeatNth = "repeat_nth"
        case repeatWeekday = "repeat_weekday"
        case repeatEndType = "repeat_end_type"
        case repeatCount = "repeat_count"
        case repeatUntil = "repeat_until"
    }

    init(
        id: String,
        scheduleDate: String,
        endDate: String?,
        title: String,
        tag: String,
        repeatType: String? = "none",
        repeatInterval: Int? = 1,
        repeatWeekdays: String? = nil,
        repeatMonthlyRule: String? = "day",
        repeatMonthDay: Int? = nil,
        repeatNth: Int? = nil,
        repeatWeekday: Int? = nil,
        repeatEndType: String? = "never",
        repeatCount: Int? = nil,
        repeatUntil: String? = nil,
        seriesId: String? = nil,
        seriesStartDate: String? = nil,
        isOccurrence: Bool = false
    ) {
        self.id = id
        self.scheduleDate = scheduleDate
        self.endDate = endDate
        self.title = title
        self.tag = tag
        self.repeatType = repeatType
        self.repeatInterval = repeatInterval
        self.repeatWeekdays = repeatWeekdays
        self.repeatMonthlyRule = repeatMonthlyRule
        self.repeatMonthDay = repeatMonthDay
        self.repeatNth = repeatNth
        self.repeatWeekday = repeatWeekday
        self.repeatEndType = repeatEndType
        self.repeatCount = repeatCount
        self.repeatUntil = repeatUntil
        self.seriesId = seriesId
        self.seriesStartDate = seriesStartDate
        self.isOccurrence = isOccurrence
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        scheduleDate = try container.decode(String.self, forKey: .scheduleDate)
        endDate = try container.decodeIfPresent(String.self, forKey: .endDate)
        title = try container.decode(String.self, forKey: .title)
        tag = try container.decode(String.self, forKey: .tag)
        repeatType = try container.decodeIfPresent(String.self, forKey: .repeatType)
        repeatInterval = try container.decodeIfPresent(Int.self, forKey: .repeatInterval)
        repeatWeekdays = try container.decodeIfPresent(String.self, forKey: .repeatWeekdays)
        repeatMonthlyRule = try container.decodeIfPresent(String.self, forKey: .repeatMonthlyRule)
        repeatMonthDay = try container.decodeIfPresent(Int.self, forKey: .repeatMonthDay)
        repeatNth = try container.decodeIfPresent(Int.self, forKey: .repeatNth)
        repeatWeekday = try container.decodeIfPresent(Int.self, forKey: .repeatWeekday)
        repeatEndType = try container.decodeIfPresent(String.self, forKey: .repeatEndType)
        repeatCount = try container.decodeIfPresent(Int.self, forKey: .repeatCount)
        repeatUntil = try container.decodeIfPresent(String.self, forKey: .repeatUntil)
        seriesId = id
        seriesStartDate = scheduleDate
        isOccurrence = false
    }

    var resolvedEndDate: String {
        endDate ?? scheduleDate
    }

    var resolvedRepeatType: ScheduleRepeatType {
        ScheduleRepeatType.normalize(repeatType)
    }

    var resolvedRepeatEndType: ScheduleRepeatEndType {
        if let raw = repeatEndType, !raw.isEmpty {
            return ScheduleRepeatEndType.normalize(raw)
        }
        // 구 데이터: end_type 없고 until만 있으면 until
        if let until = repeatUntil, !until.isEmpty {
            return .until
        }
        return .never
    }

    var resolvedInterval: Int {
        max(1, repeatInterval ?? 1)
    }

    var resolvedWeekdays: [Int] {
        ScheduleDateHelper.parseWeekdays(repeatWeekdays)
    }

    var resolvedMonthlyRule: ScheduleMonthlyRule {
        ScheduleMonthlyRule.normalize(repeatMonthlyRule)
    }

    var isRecurring: Bool {
        resolvedRepeatType != .none
    }

    var isMultiDay: Bool {
        resolvedEndDate != scheduleDate
    }

    var deleteTargetId: String {
        seriesId ?? id
    }

    var repeatDescription: String {
        ScheduleDateHelper.describe(self)
    }

    func contains(date: String) -> Bool {
        date >= scheduleDate && date <= resolvedEndDate
    }

    func occurrenceCopy(
        id: String,
        scheduleDate: String,
        endDate: String,
        seriesId: String,
        seriesStartDate: String,
        isOccurrence: Bool
    ) -> ScheduleItem {
        ScheduleItem(
            id: id,
            scheduleDate: scheduleDate,
            endDate: endDate,
            title: title,
            tag: tag,
            repeatType: repeatType,
            repeatInterval: repeatInterval,
            repeatWeekdays: repeatWeekdays,
            repeatMonthlyRule: repeatMonthlyRule,
            repeatMonthDay: repeatMonthDay,
            repeatNth: repeatNth,
            repeatWeekday: repeatWeekday,
            repeatEndType: repeatEndType,
            repeatCount: repeatCount,
            repeatUntil: repeatUntil,
            seriesId: seriesId,
            seriesStartDate: seriesStartDate,
            isOccurrence: isOccurrence
        )
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

    static func addDays(_ ymd: String, _ days: Int) -> String? {
        guard let date = dayFormatter.date(from: ymd) else { return nil }
        guard let next = Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: date) else {
            return nil
        }
        return dayFormatter.string(from: next)
    }

    static func jsWeekday(from date: Date) -> Int {
        // Calendar weekday: 1=일 … 7=토 → JS: 0=일 … 6=토
        Calendar(identifier: .gregorian).component(.weekday, from: date) - 1
    }

    static func parseWeekdays(_ raw: String?) -> [Int] {
        guard let raw, !raw.isEmpty else { return [] }
        let values = raw.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
        return Array(Set(values.filter { $0 >= 0 && $0 <= 6 })).sorted()
    }

    static func durationOffsetDays(start: String, end: String) -> Int {
        guard let s = dayFormatter.date(from: start),
              let e = dayFormatter.date(from: end) else { return 0 }
        let days = Calendar(identifier: .gregorian).dateComponents([.day], from: s, to: e).day ?? 0
        return max(0, days)
    }

    static func describe(_ schedule: ScheduleItem) -> String {
        let type = schedule.resolvedRepeatType
        if type == .none { return "반복 없음" }

        let interval = schedule.resolvedInterval
        let endType = schedule.resolvedRepeatEndType
        var endText = ""
        if endType == .until, let until = schedule.repeatUntil, !until.isEmpty {
            endText = " · \(until)까지"
        } else if endType == .count, let count = schedule.repeatCount, count > 0 {
            endText = " · \(count)회"
        }

        switch type {
        case .weekly:
            let days = schedule.resolvedWeekdays
            let dayLabels = ScheduleWeekdayOption.all
                .filter { days.contains($0.id) }
                .map(\.label)
                .joined()
            let every = interval == 1 ? "매주" : "\(interval)주마다"
            return "\(every)\(dayLabels.isEmpty ? "" : " \(dayLabels)")\(endText)"
        case .monthly:
            let every = interval == 1 ? "매월" : "\(interval)개월마다"
            let rule = schedule.resolvedMonthlyRule
            let detail: String
            switch rule {
            case .day:
                detail = " \(schedule.repeatMonthDay ?? 1)일"
            case .lastDay:
                detail = " 말일"
            case .lastWeekday:
                let w = ScheduleWeekdayOption.label(for: schedule.repeatWeekday ?? 1)
                detail = " 마지막 \(w)요일"
            case .nthWeekday:
                let nthLabels = ["", "첫 번째", "두 번째", "세 번째", "네 번째"]
                let nth = schedule.repeatNth ?? 1
                let nthLabel = (nth >= 1 && nth <= 4) ? nthLabels[nth] : "\(nth)번째"
                let w = ScheduleWeekdayOption.label(for: schedule.repeatWeekday ?? 1)
                detail = " \(nthLabel) \(w)요일"
            }
            return "\(every)\(detail)\(endText)"
        case .yearly:
            let every = interval == 1 ? "매년" : "\(interval)년마다"
            let start = schedule.seriesStartDate ?? schedule.scheduleDate
            if let date = dayFormatter.date(from: start) {
                let cal = Calendar(identifier: .gregorian)
                let m = cal.component(.month, from: date)
                let d = cal.component(.day, from: date)
                return "\(every) \(m)월 \(d)일\(endText)"
            }
            return "\(every)\(endText)"
        case .none:
            return "반복 없음"
        }
    }

    private static func nthWeekdayOfMonth(year: Int, month: Int, weekday: Int, nth: Int) -> String? {
        let calendar = Calendar(identifier: .gregorian)
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        guard let first = calendar.date(from: comps),
              let dayRange = calendar.range(of: .day, in: .month, for: first)
        else { return nil }

        if nth == -1 {
            for day in stride(from: dayRange.count, through: 1, by: -1) {
                comps.day = day
                guard let date = calendar.date(from: comps) else { continue }
                if jsWeekday(from: date) == weekday {
                    return dayFormatter.string(from: date)
                }
            }
            return nil
        }

        var matches: [Date] = []
        for day in dayRange {
            comps.day = day
            guard let date = calendar.date(from: comps) else { continue }
            if jsWeekday(from: date) == weekday {
                matches.append(date)
            }
        }
        guard nth >= 1, nth <= matches.count else { return nil }
        return dayFormatter.string(from: matches[nth - 1])
    }

    private static func generateOccurrenceStarts(
        seriesStart: String,
        schedule: ScheduleItem,
        hardLimit: String,
        maxCount: Int
    ) -> [String] {
        let type = schedule.resolvedRepeatType
        let interval = schedule.resolvedInterval
        var starts: [String] = []
        let calendar = Calendar(identifier: .gregorian)

        switch type {
        case .weekly:
            var weekdays = schedule.resolvedWeekdays
            if weekdays.isEmpty, let origin = dayFormatter.date(from: seriesStart) {
                weekdays = [jsWeekday(from: origin)]
            }
            guard let origin = dayFormatter.date(from: seriesStart) else { return [] }
            let originWeekStart = calendar.date(
                byAdding: .day,
                value: -jsWeekday(from: origin),
                to: origin
            ) ?? origin

            var cursor = origin
            var guardCount = 0
            while dayFormatter.string(from: cursor) <= hardLimit && guardCount < 2000 {
                let weekStart = calendar.date(
                    byAdding: .day,
                    value: -jsWeekday(from: cursor),
                    to: cursor
                ) ?? cursor
                let weeksFromOrigin =
                    calendar.dateComponents([.day], from: originWeekStart, to: weekStart).day.map { $0 / 7 } ?? 0
                if weeksFromOrigin >= 0 && weeksFromOrigin % interval == 0 {
                    let dow = jsWeekday(from: cursor)
                    let ymd = dayFormatter.string(from: cursor)
                    if weekdays.contains(dow), ymd >= seriesStart {
                        starts.append(ymd)
                        if starts.count >= maxCount { break }
                    }
                }
                guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
                cursor = next
                guardCount += 1
            }
            return starts

        case .monthly:
            guard let start = dayFormatter.date(from: seriesStart) else { return [] }
            var year = calendar.component(.year, from: start)
            var month = calendar.component(.month, from: start)
            var monthIndex = 0
            var guardCount = 0
            let rule = schedule.resolvedMonthlyRule

            while guardCount < 600 {
                if monthIndex % interval == 0 {
                    var occ: String?
                    switch rule {
                    case .day:
                        let day = schedule.repeatMonthDay ?? calendar.component(.day, from: start)
                        var comps = DateComponents()
                        comps.year = year
                        comps.month = month
                        comps.day = 1
                        if let first = calendar.date(from: comps),
                           let range = calendar.range(of: .day, in: .month, for: first) {
                            comps.day = min(max(1, day), range.count)
                            if let date = calendar.date(from: comps) {
                                occ = dayFormatter.string(from: date)
                            }
                        }
                    case .lastDay:
                        var comps = DateComponents()
                        comps.year = year
                        comps.month = month
                        comps.day = 1
                        if let first = calendar.date(from: comps),
                           let range = calendar.range(of: .day, in: .month, for: first) {
                            comps.day = range.count
                            if let date = calendar.date(from: comps) {
                                occ = dayFormatter.string(from: date)
                            }
                        }
                    case .lastWeekday:
                        let weekday = schedule.repeatWeekday ?? jsWeekday(from: start)
                        occ = nthWeekdayOfMonth(year: year, month: month, weekday: weekday, nth: -1)
                    case .nthWeekday:
                        let nth = schedule.repeatNth ?? 1
                        let weekday = schedule.repeatWeekday ?? jsWeekday(from: start)
                        occ = nthWeekdayOfMonth(year: year, month: month, weekday: weekday, nth: nth)
                    }

                    if let occ, occ >= seriesStart, occ <= hardLimit {
                        starts.append(occ)
                        if starts.count >= maxCount { break }
                    }
                    if let occ, occ > hardLimit { break }
                }

                month += 1
                if month > 12 {
                    month = 1
                    year += 1
                }
                monthIndex += 1
                guardCount += 1
            }
            return starts

        case .yearly:
            guard let start = dayFormatter.date(from: seriesStart) else { return [] }
            let month = calendar.component(.month, from: start)
            let day = calendar.component(.day, from: start)
            var year = calendar.component(.year, from: start)
            var yearIndex = 0
            var guardCount = 0
            while guardCount < 200 {
                if yearIndex % interval == 0 {
                    var comps = DateComponents()
                    comps.year = year
                    comps.month = month
                    comps.day = 1
                    if let first = calendar.date(from: comps),
                       let range = calendar.range(of: .day, in: .month, for: first) {
                        comps.day = min(day, range.count)
                        if let date = calendar.date(from: comps) {
                            let occ = dayFormatter.string(from: date)
                            if occ >= seriesStart, occ <= hardLimit {
                                starts.append(occ)
                                if starts.count >= maxCount { break }
                            }
                            if occ > hardLimit { break }
                        }
                    }
                }
                year += 1
                yearIndex += 1
                guardCount += 1
            }
            return starts

        case .none:
            return [seriesStart]
        }
    }

    /// 마스터 일정을 월 범위에 맞게 펼칩니다.
    static func expand(_ schedule: ScheduleItem, rangeStart: String, rangeEnd: String) -> [ScheduleItem] {
        let type = schedule.resolvedRepeatType
        let offset = durationOffsetDays(start: schedule.scheduleDate, end: schedule.resolvedEndDate)

        if type == .none {
            if schedule.resolvedEndDate < rangeStart || schedule.scheduleDate > rangeEnd {
                return []
            }
            return [
                schedule.occurrenceCopy(
                    id: schedule.id,
                    scheduleDate: schedule.scheduleDate,
                    endDate: schedule.resolvedEndDate,
                    seriesId: schedule.id,
                    seriesStartDate: schedule.scheduleDate,
                    isOccurrence: false
                )
            ]
        }

        let endType = schedule.resolvedRepeatEndType
        let maxCount = endType == .count ? max(1, schedule.repeatCount ?? 1) : 500

        var hardLimit = rangeEnd
        if endType == .until, let until = schedule.repeatUntil, !until.isEmpty, until < hardLimit {
            hardLimit = until
        }

        let generateUntil: String = {
            if endType == .count {
                return addDays(schedule.scheduleDate, 3650) ?? rangeEnd
            }
            return hardLimit
        }()

        let allStarts = generateOccurrenceStarts(
            seriesStart: schedule.scheduleDate,
            schedule: schedule,
            hardLimit: generateUntil,
            maxCount: maxCount
        )

        return allStarts.compactMap { occStart -> ScheduleItem? in
            guard let occEnd = addDays(occStart, offset) else { return nil }
            guard occEnd >= rangeStart, occStart <= rangeEnd, occStart <= hardLimit else { return nil }
            return schedule.occurrenceCopy(
                id: "\(schedule.id)__\(occStart)",
                scheduleDate: occStart,
                endDate: occEnd,
                seriesId: schedule.id,
                seriesStartDate: schedule.scheduleDate,
                isOccurrence: true
            )
        }
    }
}
