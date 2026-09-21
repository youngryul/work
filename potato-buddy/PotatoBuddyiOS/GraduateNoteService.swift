import Foundation

// MARK: - 모델 (웹 graduate_notes 테이블과 동일)

/// 대학원 기록 카테고리 (`graduate_notes.category`)
enum GraduateNoteCategory: String, CaseIterable, Identifiable {
    case preview
    case lecture
    case review

    var id: String { rawValue }

    var label: String {
        switch self {
        case .preview: return "예습"
        case .lecture: return "강의"
        case .review: return "복습"
        }
    }

    var icon: String {
        switch self {
        case .preview: return "📖"
        case .lecture: return "🎓"
        case .review: return "✏️"
        }
    }
}

/// 블록 타입 (웹 블록 에디터와 동일한 문자열)
enum GraduateBlockType {
    static let paragraph = "paragraph"
    static let heading1 = "h1"
    static let heading2 = "h2"
    static let image = "image"
    static let divider = "divider"
}

/// 노트 본문 블록 — `graduate_notes.content` (jsonb 배열)의 한 원소
struct GraduateNoteBlock: Codable, Identifiable, Hashable {
    var id: String
    var type: String
    /// 텍스트 블록은 본문, 이미지 블록은 공개 URL
    var content: String

    enum CodingKeys: String, CodingKey {
        case id, type, content
    }

    init(type: String, content: String = "") {
        let millis = Int(Date().timeIntervalSince1970 * 1000)
        self.id = "block-\(millis)-\(UUID().uuidString.prefix(5).lowercased())"
        self.type = type
        self.content = content
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decodeIfPresent(String.self, forKey: .id) ?? "block-\(UUID().uuidString)"
        type = try c.decodeIfPresent(String.self, forKey: .type) ?? GraduateBlockType.paragraph
        content = (try? c.decodeIfPresent(String.self, forKey: .content)) ?? ""
    }
}

/// 대학원 기록 한 건. 목록 조회는 `content`를 가져오지 않으므로 빈 배열일 수 있다.
struct GraduateNoteItem: Codable, Identifiable, Hashable {
    let id: String
    var semesterId: String
    var subjectName: String
    var category: String
    var title: String
    var content: [GraduateNoteBlock]
    var noteDate: String
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, category, title, content
        case semesterId = "semester_id"
        case subjectName = "subject_name"
        case noteDate = "note_date"
        case createdAt = "created_at"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        semesterId = try c.decodeIfPresent(String.self, forKey: .semesterId) ?? ""
        subjectName = try c.decodeIfPresent(String.self, forKey: .subjectName) ?? ""
        category = try c.decodeIfPresent(String.self, forKey: .category) ?? GraduateNoteCategory.preview.rawValue
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        content = try c.decodeIfPresent([GraduateNoteBlock].self, forKey: .content) ?? []
        noteDate = try c.decodeIfPresent(String.self, forKey: .noteDate) ?? ""
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
    }

    /// `2026-09-21` → `2026.09.21`
    var displayDate: String {
        noteDate.replacingOccurrences(of: "-", with: ".")
    }
}

/// `yyyy-MM-dd` 날짜 문자열 변환 (DB `note_date`)
enum GraduateNoteDate {
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func string(from date: Date) -> String {
        formatter.string(from: date)
    }

    static func date(from string: String) -> Date? {
        formatter.date(from: string)
    }
}

// MARK: - Supabase 조회/저장

extension SupabaseService {
    /// 목록 조회용 컬럼 — 본문(content)은 무거우므로 제외 (웹 fetchNotes와 동일)
    private static let graduateNoteListColumns = "id,semester_id,subject_name,category,title,note_date,created_at"

    /// 과목별 노트 목록 (전체 카테고리)
    func fetchGraduateNotes(semesterId: String, subjectName: String) async throws -> [GraduateNoteItem] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/graduate_notes")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "semester_id", value: "eq.\(semesterId)"),
            URLQueryItem(name: "subject_name", value: "eq.\(subjectName)"),
            URLQueryItem(name: "select", value: Self.graduateNoteListColumns),
            URLQueryItem(name: "order", value: "note_date.desc,created_at.desc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([GraduateNoteItem].self, from: data)
    }

    /// 노트 단건 조회 (본문 포함)
    func fetchGraduateNote(id: String) async throws -> GraduateNoteItem {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/graduate_notes")!
        components.queryItems = [
            URLQueryItem(name: "id", value: "eq.\(id)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "*"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([GraduateNoteItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    /// 빈 노트 생성
    func createGraduateNote(
        semesterId: String,
        subjectName: String,
        category: String,
        noteDate: String
    ) async throws -> GraduateNoteItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/graduate_notes")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "semester_id": semesterId,
            "subject_name": subjectName,
            "category": category,
            "title": "",
            "content": [Any](),
            "note_date": noteDate,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([GraduateNoteItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    /// 제목·본문·날짜 저장
    @discardableResult
    func updateGraduateNote(
        id: String,
        title: String,
        blocks: [GraduateNoteBlock],
        noteDate: String
    ) async throws -> GraduateNoteItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/graduate_notes?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let blocksJSON = try JSONSerialization.jsonObject(with: JSONEncoder().encode(blocks))
        let body: [String: Any] = [
            "title": title,
            "content": blocksJSON,
            "note_date": noteDate,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([GraduateNoteItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteGraduateNote(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/graduate_notes?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    /// 노트 이미지 업로드 (웹과 같은 `images/graduate-notes/` 경로) → 공개 URL
    func uploadGraduateNoteImage(_ jpegData: Data) async throws -> String {
        let millis = Int(Date().timeIntervalSince1970 * 1000)
        let fileName = "\(millis)-\(UUID().uuidString.prefix(8).lowercased()).jpg"
        return try await uploadImageData(
            jpegData,
            folder: "graduate-notes",
            fileName: fileName,
            contentType: "image/jpeg"
        )
    }
}
