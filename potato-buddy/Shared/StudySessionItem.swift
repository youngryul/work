import Foundation
import SwiftUI

// MARK: - 타이머 카테고리

enum StudyTimerCategory: String, CaseIterable, Identifiable {
    case book = "book"
    case study = "study"
    case exercise = "exercise"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .book:     return "책"
        case .study:    return "공부"
        case .exercise: return "운동"
        }
    }

    var emoji: String {
        switch self {
        case .book:     return "📖"
        case .study:    return "📚"
        case .exercise: return "🏃"
        }
    }

    static func normalize(_ raw: String?) -> StudyTimerCategory {
        guard let raw, let cat = StudyTimerCategory(rawValue: raw) else {
            return .study
        }
        return cat
    }
}

struct StudyTimerCategoryPicker: View {
    @Binding var selection: StudyTimerCategory
    var disabled: Bool = false

    var body: some View {
        HStack(spacing: 8) {
            ForEach(StudyTimerCategory.allCases) { cat in
                Button {
                    selection = cat
                } label: {
                    Text("\(cat.emoji) \(cat.label)")
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            Capsule().fill(
                                selection == cat
                                    ? Color.green.opacity(0.85)
                                    : Color(.secondarySystemBackground)
                            )
                        )
                        .foregroundColor(selection == cat ? .white : .primary)
                }
                .buttonStyle(.plain)
                .disabled(disabled)
                .opacity(disabled ? 0.55 : 1)
            }
        }
    }
}

// MARK: - 세션 모델

struct StudySessionItem: Decodable, Identifiable {
    let id: String
    let studyDate: String
    let durationSeconds: Int
    let source: String
    let category: String?

    enum CodingKeys: String, CodingKey {
        case id
        case studyDate       = "study_date"
        case durationSeconds = "duration_seconds"
        case source
        case category
    }

    var normalizedCategory: StudyTimerCategory {
        StudyTimerCategory.normalize(category)
    }
}

// MARK: - 일자별 집계

struct StudyDaySummary: Identifiable {
    let date: String
    let totalSeconds: Int
    let bySource: [String: Int]
    let byCategory: [StudyTimerCategory: Int]

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

func emptyCategoryTotals() -> [StudyTimerCategory: Int] {
    var map: [StudyTimerCategory: Int] = [:]
    for cat in StudyTimerCategory.allCases {
        map[cat] = 0
    }
    return map
}

func addSeconds(_ seconds: Int, category: StudyTimerCategory, to totals: inout [StudyTimerCategory: Int]) {
    totals[category, default: 0] += seconds
}
