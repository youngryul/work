import Foundation

struct StudySessionItem: Decodable, Identifiable {
    let id: String
    let studyDate: String
    let durationSeconds: Int
    let source: String

    enum CodingKeys: String, CodingKey {
        case id
        case studyDate       = "study_date"
        case durationSeconds = "duration_seconds"
        case source
    }
}

// MARK: - 일자별 집계

struct StudyDaySummary: Identifiable {
    let date: String
    let totalSeconds: Int
    let bySource: [String: Int]

    var id: String { date }
}

// MARK: - 시간 포맷 유틸

func formatStudyDuration(_ totalSeconds: Int) -> String {
    let sec = max(0, totalSeconds)
    let hours   = sec / 3600
    let minutes = (sec % 3600) / 60
    let seconds = sec % 60
    if sec < 60 { return "\(sec)초" }
    if hours > 0 && minutes > 0 { return "\(hours)시간 \(minutes)분" }
    if hours > 0 { return "\(hours)시간" }
    if minutes > 0 { return "\(minutes)분" }
    return "\(seconds)초"
}

func formatStudyDurationShort(_ totalSeconds: Int) -> String {
    let sec = max(0, totalSeconds)
    if sec <= 0 { return "" }
    let hours   = sec / 3600
    let minutes = (sec % 3600) / 60
    if hours > 0 && minutes > 0 { return "\(hours)h\(minutes)m" }
    if hours > 0 { return "\(hours)h" }
    if minutes > 0 { return "\(minutes)m" }
    return "\(sec)s"
}
