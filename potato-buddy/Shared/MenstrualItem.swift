import Foundation

// MARK: - 설정

struct MenstrualSettings {
    var cycleLength: Int
    var periodLength: Int
    var isEnabled: Bool
    var onboardingCompleted: Bool

    static let defaultSettings = MenstrualSettings(
        cycleLength: 28,
        periodLength: 5,
        isEnabled: true,
        onboardingCompleted: false
    )
}

// MARK: - 기록

struct MenstrualPeriodRecord: Identifiable, Decodable {
    let id: String
    let startDate: String
    let endDate: String
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id
        case startDate = "start_date"
        case endDate   = "end_date"
        case notes
    }
}

// MARK: - 달력 마커

enum MenstrualMarkerType {
    case recorded(recordId: String)
    case predicted
}

// MARK: - 날짜 마커 계산 유틸

enum MenstrualCalendarHelper {
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    static func buildMarkers(
        records: [MenstrualPeriodRecord],
        settings: MenstrualSettings,
        year: Int,
        month: Int
    ) -> [String: MenstrualMarkerType] {
        var markers: [String: MenstrualMarkerType] = [:]
        let cal = Calendar(identifier: .gregorian)

        var comps = DateComponents()
        comps.year = year; comps.month = month; comps.day = 1
        guard let startOfMonth = cal.date(from: comps),
              let endOfMonth = cal.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth)
        else { return markers }

        let rangeStart = formatter.string(from: startOfMonth)
        let rangeEnd   = formatter.string(from: endOfMonth)

        // 기록된 생리
        for record in records {
            var current = record.startDate
            while current <= record.endDate {
                if current >= rangeStart && current <= rangeEnd {
                    markers[current] = .recorded(recordId: record.id)
                }
                guard let date = formatter.date(from: current),
                      let next = cal.date(byAdding: .day, value: 1, to: date)
                else { break }
                current = formatter.string(from: next)
            }
        }

        // 예측 생리 (최근 시작일 기준 향후 3개월)
        let sorted = records.sorted { $0.startDate > $1.startDate }
        if let lastRecord = sorted.first,
           let lastStart = formatter.date(from: lastRecord.startDate) {
            for cycle in 1...4 {
                let offset = settings.cycleLength * cycle
                guard let predStart = cal.date(byAdding: .day, value: offset, to: lastStart) else { continue }
                for day in 0..<settings.periodLength {
                    guard let predDay = cal.date(byAdding: .day, value: day, to: predStart) else { continue }
                    let key = formatter.string(from: predDay)
                    if key >= rangeStart && key <= rangeEnd && markers[key] == nil {
                        markers[key] = .predicted
                    }
                }
            }
        }

        return markers
    }
}
