import Foundation

/// 프로젝트 기록 (`project_records`) — 웹 Record와 동일
struct ProjectRecordItem: Codable, Identifiable, Hashable {
    let id: String
    var projectName: String
    var type: String
    var date: String
    var title: String
    var background: String?
    var isMain: Bool

    enum CodingKeys: String, CodingKey {
        case id, type, date, title, background
        case projectName = "projectname"
        case isMain = "is_main"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        projectName = try c.decode(String.self, forKey: .projectName)
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? "MEETING"
        date = try c.decode(String.self, forKey: .date)
        title = try c.decode(String.self, forKey: .title)
        background = try c.decodeIfPresent(String.self, forKey: .background)
        isMain = try c.decodeIfPresent(Bool.self, forKey: .isMain) ?? false
    }

    init(
        id: String,
        projectName: String,
        type: String = "MEETING",
        date: String,
        title: String,
        background: String? = nil,
        isMain: Bool = false
    ) {
        self.id = id
        self.projectName = projectName
        self.type = type
        self.date = date
        self.title = title
        self.background = background
        self.isMain = isMain
    }

    /// 본문 (웹 `content` ↔ DB `background`)
    var content: String {
        background ?? ""
    }

    var displayDate: String {
        let parts = date.split(separator: "-")
        guard parts.count == 3 else { return date }
        return "\(parts[0])년 \(Int(parts[1]) ?? 0)월 \(Int(parts[2]) ?? 0)일"
    }
}

struct ProjectCountItem: Identifiable, Hashable {
    var id: String { projectName }
    let projectName: String
    let count: Int
}

/// 기록 본문 속 사이트 주소 찾기
enum ProjectRecordLinks {
    private static let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)

    /// 본문 속 http(s) 주소에 링크를 건 텍스트 (SwiftUI Text에서 누르면 바로 열림, "www.~"도 인식)
    static func attributed(_ text: String) -> AttributedString {
        var result = AttributedString(text)
        guard let detector, !text.isEmpty else { return result }
        let range = NSRange(text.startIndex..., in: text)
        for match in detector.matches(in: text, options: [], range: range) {
            guard let url = match.url,
                  let scheme = url.scheme?.lowercased(),
                  scheme == "http" || scheme == "https",
                  let linkRange = Range(match.range, in: result) else { continue }
            result[linkRange].link = url
            result[linkRange].underlineStyle = .single
        }
        return result
    }
}
