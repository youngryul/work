import Foundation

final class SupabaseService {
    static let shared = SupabaseService()
    private init() {}

    // MARK: - 오늘 할일 조회

    func fetchTodayTasks() async throws -> [TaskItem] {
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        components.queryItems = [
            URLQueryItem(name: "istoday",   value: "eq.true"),
            URLQueryItem(name: "completed", value: "eq.false"),
            URLQueryItem(name: "user_id",   value: "eq.\(Config.userId)"),
            URLQueryItem(name: "select",    value: "id,title,category,priority"),
            URLQueryItem(name: "order",     value: "priority.asc,movedtotodayat.asc,createdat.asc"),
        ]

        var request = URLRequest(url: components.url!)
        request.addValue(Config.serviceKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(Config.serviceKey)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode([TaskItem].self, from: data)
    }

    // MARK: - 할일 완료 처리

    func completeTask(id: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(Config.userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.addValue(Config.serviceKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(Config.serviceKey)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let now = Int(Date().timeIntervalSince1970 * 1000) // 밀리초
        let body: [String: Any] = ["completed": true, "completedat": now]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try await URLSession.shared.data(for: request)
    }

    // MARK: - 할일 추가

    func addTask(title: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.serviceKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(Config.serviceKey)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let now = Int(Date().timeIntervalSince1970 * 1000)
        let body: [String: Any] = [
            "title": title,
            "istoday": true,
            "completed": false,
            "category": "작업",
            "createdat": now,
            "user_id": Config.userId,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await URLSession.shared.data(for: request)
    }
}
