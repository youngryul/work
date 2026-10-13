import Foundation

/// 내 책장에 등록된 책
struct BookItem: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let author: String?
    let publisher: String?
    let isbn: String?
    let thumbnailUrl: String?
    let description: String?
    let pageCount: Int?
    let publishedDate: String?
    let apiSource: String?
    let apiId: String?
    let isCompleted: Bool?
    let oneLineInsight: String?
    let completedAt: String?
    /// 현재까지 읽은 페이지 (웹 BookProgress 와 공유)
    let currentPage: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, author, publisher, isbn, description
        case thumbnailUrl = "thumbnail_url"
        case pageCount = "page_count"
        case publishedDate = "published_date"
        case apiSource = "api_source"
        case apiId = "api_id"
        case isCompleted = "is_completed"
        case oneLineInsight = "one_line_insight"
        case completedAt = "completed_at"
        case currentPage = "current_page"
    }

    var completed: Bool { isCompleted == true }

    /// 읽은 페이지 (미기록 시 0)
    var readPage: Int { max(0, currentPage ?? 0) }

    /// 전체 페이지 대비 진행률 0~100 (전체 페이지 정보가 없으면 nil)
    var progressPercent: Int? {
        guard let pageCount, pageCount > 0 else { return nil }
        return min(100, Int((Double(readPage) / Double(pageCount) * 100).rounded()))
    }

    /// "120쪽까지 읽음 / 300쪽 (40%)" — 웹 BookProgress 표기와 동일
    var progressLabel: String {
        guard readPage > 0 else { return "읽은 위치를 기록해보세요" }
        var label = "\(readPage)쪽까지 읽음"
        if let pageCount, pageCount > 0, let progressPercent {
            label += " / \(pageCount)쪽 (\(progressPercent)%)"
        }
        return label
    }

    var authorLabel: String {
        let value = author?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "저자 미상" : value
    }

    var pageCountLabel: String {
        guard let pageCount, pageCount > 0 else { return "" }
        return "\(pageCount)쪽"
    }
}

/// 책별 독서 기록
struct ReadingRecordItem: Codable, Identifiable, Hashable {
    let id: String
    let bookId: String
    let readingDate: String
    let startTime: String?
    let endTime: String?
    let readingMinutes: Int?
    let pagesRead: Int?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case id, notes
        case bookId = "book_id"
        case readingDate = "reading_date"
        case startTime = "start_time"
        case endTime = "end_time"
        case readingMinutes = "reading_minutes"
        case pagesRead = "pages_read"
    }

    var pagesLabel: String {
        guard let pagesRead, pagesRead > 0 else { return "페이지 미기록" }
        return "\(pagesRead)쪽"
    }
}

/// 외부 API 검색 결과 (아직 DB에 없음)
struct BookSearchResult: Identifiable, Hashable {
    var id: String { "\(apiSource)-\(apiId)" }
    let apiId: String
    let title: String
    let author: String
    let publisher: String
    let isbn: String
    let thumbnailUrl: String
    let description: String
    let pageCount: Int
    let publishedDate: String
    let apiSource: String
}

struct MonthlyReadingStats {
    let totalBooks: Int
    let totalSessions: Int
    let totalMinutes: Int

    var totalHours: Double {
        (Double(totalMinutes) / 60.0 * 10).rounded() / 10
    }
}
