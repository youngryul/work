import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

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

    /// 타이머 전체 배경 이미지 에셋 이름 (영어 파일명 사용으로 런타임 로드 안정화)
    var timerBackgroundImageName: String {
        switch self {
        case .book:     return "timer-book"
        case .study:    return "timer-study"
        case .exercise: return "timer-exercise"
        }
    }

    /// 마이그레이션/번들 차이를 흡수하기 위한 후보 파일명 (확장자 제외)
    var timerBackgroundImageCandidates: [String] {
        switch self {
        case .book:
            return ["timer-book", "타이머책"]
        case .study:
            return ["timer-study", "타이머"]
        case .exercise:
            return ["timer-exercise", "타이머운동"]
        }
    }

    /// 뽀모도로 이미지 후보 (공부는 포실이, 책·운동은 테마)
    var pomodoroBackgroundImageCandidates: [String] {
        switch self {
        case .book:
            return ["timer-book", "타이머책"]
        case .study:
            return ["포실이뽀모도로"]
        case .exercise:
            return ["timer-exercise", "타이머운동"]
        }
    }

    /// 번들에서 카테고리 배경 이미지를 로드 (png/jpg 모두 시도)
    #if canImport(UIKit)
    func loadBackgroundUIImage() -> UIImage? {
        Self.loadUIImage(namedCandidates: timerBackgroundImageCandidates)
    }

    func loadPomodoroUIImage() -> UIImage? {
        Self.loadUIImage(namedCandidates: pomodoroBackgroundImageCandidates)
    }

    static func loadUIImage(namedCandidates names: [String]) -> UIImage? {
        let extensions = ["png", "jpg", "jpeg"]
        for name in names {
            if let image = UIImage(named: name) {
                return image
            }
            for ext in extensions {
                if let url = Bundle.main.url(forResource: name, withExtension: ext),
                   let image = UIImage(contentsOfFile: url.path) {
                    return image
                }
            }
        }
        return nil
    }
    #endif

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
