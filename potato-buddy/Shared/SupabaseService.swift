import Foundation

final class SupabaseService {
    static let shared = SupabaseService()
    private init() {}

    // MARK: - 인증 정보 (MainActor에서 가져오기)

    private func authInfo() async -> (userId: String, token: String) {
        await MainActor.run {
            (AuthService.shared.userId, AuthService.shared.accessToken)
        }
    }

    private func headers(token: String) -> [String: String] {
        [
            "apikey":        Config.anonKey,
            "Authorization": "Bearer \(token)",
            "Content-Type":  "application/json",
        ]
    }

    // MARK: - 오늘 할일 조회

    func fetchTodayTasks() async throws -> [TaskItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        components.queryItems = [
            URLQueryItem(name: "istoday",   value: "eq.true"),
            URLQueryItem(name: "completed", value: "eq.false"),
            URLQueryItem(name: "user_id",   value: "eq.\(userId)"),
            URLQueryItem(name: "select",    value: "id,title,category,priority"),
            URLQueryItem(name: "order",     value: "priority.asc,movedtotodayat.asc,createdat.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode([TaskItem].self, from: data)
    }

    // MARK: - 할일 완료 처리

    func completeTask(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let body: [String: Any] = ["completed": true, "completedat": now]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 할일 추가

    func addTask(title: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let body: [String: Any] = [
            "title":     title,
            "istoday":   true,
            "completed": false,
            "category":  "작업",
            "createdat": now,
            "user_id":   userId,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 백로그 조회 (istoday = false, completed = false)

    func fetchBacklogTasks() async throws -> [TaskItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        components.queryItems = [
            URLQueryItem(name: "istoday",   value: "eq.false"),
            URLQueryItem(name: "completed", value: "eq.false"),
            URLQueryItem(name: "user_id",   value: "eq.\(userId)"),
            URLQueryItem(name: "select",    value: "id,title,category,priority"),
            URLQueryItem(name: "order",     value: "priority.asc,createdat.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode([TaskItem].self, from: data)
    }

    // MARK: - 백로그에 할일 추가

    func addBacklogTask(title: String, category: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let body: [String: Any] = [
            "title":     title,
            "istoday":   false,
            "completed": false,
            "category":  category,
            "createdat": now,
            "user_id":   userId,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 백로그 → 오늘 이동

    func moveToToday(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let formatter = ISO8601DateFormatter()
        let now = formatter.string(from: Date())
        let body: [String: Any] = [
            "istoday":        true,
            "movedtotodayat": now,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 할일 삭제

    func deleteTask(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 월별 일기 목록 조회

    func fetchDiaries(year: Int, month: Int) async throws -> [DiaryItem] {
        let (userId, token) = await authInfo()

        // 월의 시작일과 마지막 날 계산
        var startComponents = DateComponents()
        startComponents.year  = year
        startComponents.month = month
        startComponents.day   = 1
        let calendar = Calendar(identifier: .gregorian)
        guard let startDate = calendar.date(from: startComponents),
              let endDate   = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startDate)
        else {
            return []
        }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let startStr = dateFormatter.string(from: startDate)
        let endStr   = dateFormatter.string(from: endDate)

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/diaries")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "date",    value: "gte.\(startStr)"),
            URLQueryItem(name: "date",    value: "lte.\(endStr)"),
            URLQueryItem(name: "select",  value: "id,date,content,image_url,emotion"),
            URLQueryItem(name: "order",   value: "date.desc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode([DiaryItem].self, from: data)
    }

    // MARK: - 날짜별 일기 조회

    func fetchDiary(date: String) async throws -> DiaryItem? {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/diaries")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "date",    value: "eq.\(date)"),
            URLQueryItem(name: "select",  value: "id,date,content,image_url,emotion"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, _) = try await URLSession.shared.data(for: request)
        let items = try JSONDecoder().decode([DiaryItem].self, from: data)
        return items.first
    }

    // MARK: - 일기 저장/수정 (upsert)

    func saveDiary(date: String, content: String) async throws -> DiaryItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/diaries")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer")

        let isoFormatter = ISO8601DateFormatter()
        let nowString = isoFormatter.string(from: Date())
        let body: [String: Any] = [
            "date":       date,
            "content":    content,
            "user_id":    userId,
            "updated_at": nowString,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, _) = try await URLSession.shared.data(for: request)
        let items = try JSONDecoder().decode([DiaryItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }
}
