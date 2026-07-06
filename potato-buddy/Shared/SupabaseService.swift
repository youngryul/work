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

    /// HTTP 응답 상태코드 확인 후 에러 메시지 throw
    private func checkResponse(_ data: Data, _ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse else { return }
        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONDecoder().decode(SupabaseError.self, from: data))?.message
                ?? String(data: data, encoding: .utf8)
                ?? "HTTP \(http.statusCode)"
            throw NSError(domain: "SupabaseService", code: http.statusCode,
                          userInfo: [NSLocalizedDescriptionKey: msg])
        }
    }

    private struct SupabaseError: Decodable {
        let message: String?
    }

    /// JWT 만료 시 자동 갱신 후 1회 재시도
    private func fetch(_ request: URLRequest) async throws -> (Data, URLResponse) {
        let (data, response) = try await URLSession.shared.data(for: request)

        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            let body = String(data: data, encoding: .utf8) ?? ""
            if body.contains("jwt expired") || body.contains("JWT expired") {
                try await AuthService.shared.refreshSession()
                let newToken = await MainActor.run { AuthService.shared.accessToken }

                var retryRequest = request
                retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                return try await URLSession.shared.data(for: retryRequest)
            }
        }

        return (data, response)
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

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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

        _ = try await fetch(request)
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
        _ = try await fetch(request)
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

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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
        _ = try await fetch(request)
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
        _ = try await fetch(request)
    }

    // MARK: - 할일 삭제

    func deleteTask(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        _ = try await fetch(request)
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

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([DiaryItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    // MARK: - 월별 일정 조회

    func fetchSchedules(year: Int, month: Int) async throws -> [ScheduleItem] {
        let (userId, token) = await authInfo()
        let range = ScheduleDateHelper.monthRange(year: year, month: month)
        guard !range.start.isEmpty, !range.end.isEmpty else { return [] }

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "schedule_date", value: "lte.\(range.end)"),
            URLQueryItem(
                name: "or",
                value: "(end_date.gte.\(range.start),and(end_date.is.null,schedule_date.gte.\(range.start)))"
            ),
            URLQueryItem(name: "select", value: "id,schedule_date,end_date,title,tag"),
            URLQueryItem(name: "order", value: "schedule_date.asc,created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([ScheduleItem].self, from: data)
    }

    // MARK: - 일정 추가

    func createSchedule(
        scheduleDate: String,
        endDate: String,
        title: String,
        tag: String
    ) async throws -> ScheduleItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "schedule_date": scheduleDate,
            "end_date": endDate,
            "title": title,
            "tag": tag,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ScheduleItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    // MARK: - 일정 삭제

    func deleteSchedule(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        _ = try await fetch(request)
    }

    // MARK: - 습관 트래커 조회

    func fetchHabitTrackers(year: Int, month: Int) async throws -> [HabitTrackerItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/habit_trackers")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "year", value: "eq.\(year)"),
            URLQueryItem(name: "month", value: "eq.\(month)"),
            URLQueryItem(name: "select", value: "id,year,month,title,color"),
            URLQueryItem(name: "order", value: "created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        var trackers = try JSONDecoder().decode([HabitTrackerItem].self, from: data)

        try await withThrowingTaskGroup(of: (Int, [HabitTrackerDayItem]).self) { group in
            for index in trackers.indices {
                let trackerId = trackers[index].id
                group.addTask {
                    let days = try await self.fetchHabitTrackerDays(trackerId: trackerId)
                    return (index, days)
                }
            }

            for try await (index, days) in group {
                trackers[index].days = days
            }
        }

        return trackers
    }

    private func fetchHabitTrackerDays(trackerId: String) async throws -> [HabitTrackerDayItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/habit_tracker_days")!
        components.queryItems = [
            URLQueryItem(name: "habit_tracker_id", value: "eq.\(trackerId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,habit_tracker_id,day,is_completed"),
            URLQueryItem(name: "order", value: "day.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([HabitTrackerDayItem].self, from: data)
    }

    // MARK: - 습관 트래커 생성

    func createHabitTracker(
        year: Int,
        month: Int,
        title: String,
        color: String
    ) async throws -> HabitTrackerItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/habit_trackers")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "year": year,
            "month": month,
            "title": title,
            "color": color,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([HabitTrackerItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    // MARK: - 습관 트래커 삭제

    func deleteHabitTracker(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/habit_trackers?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        _ = try await fetch(request)
    }

    // MARK: - 습관 트래커 제목 수정

    func updateHabitTrackerTitle(id: String, title: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/habit_trackers?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let body = ["title": title]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        _ = try await fetch(request)
    }

    // MARK: - 습관 트래커 일별 체크 토글

    func toggleHabitTrackerDay(
        trackerId: String,
        day: Int,
        isCompleted: Bool
    ) async throws -> HabitTrackerDayItem {
        let (userId, token) = await authInfo()

        var existingComponents = URLComponents(string: "\(Config.supabaseURL)/rest/v1/habit_tracker_days")!
        existingComponents.queryItems = [
            URLQueryItem(name: "habit_tracker_id", value: "eq.\(trackerId)"),
            URLQueryItem(name: "day", value: "eq.\(day)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id"),
            URLQueryItem(name: "limit", value: "1"),
        ]

        var existingRequest = URLRequest(url: existingComponents.url!)
        headers(token: token).forEach { existingRequest.addValue($1, forHTTPHeaderField: $0) }

        let (existingData, existingResponse) = try await fetch(existingRequest)
        struct ExistingDay: Decodable { let id: String }
        try checkResponse(existingData, existingResponse)
        let existingItems = try JSONDecoder().decode([ExistingDay].self, from: existingData)

        var completedAt: Any = NSNull()
        if isCompleted { completedAt = ISO8601DateFormatter().string(from: Date()) }
        let payload: [String: Any] = [
            "is_completed": isCompleted,
            "completed_at": completedAt,
        ]

        if let existing = existingItems.first {
            let url = URL(string: "\(Config.supabaseURL)/rest/v1/habit_tracker_days?id=eq.\(existing.id)&user_id=eq.\(userId)")!
            var request = URLRequest(url: url)
            request.httpMethod = "PATCH"
            headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
            request.addValue("return=representation", forHTTPHeaderField: "Prefer")
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (data, response) = try await fetch(request)
            try checkResponse(data, response)
            let items = try JSONDecoder().decode([HabitTrackerDayItem].self, from: data)
            guard let item = items.first else {
                throw URLError(.badServerResponse)
            }
            return item
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/habit_tracker_days")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var insertPayload = payload
        insertPayload["user_id"] = userId
        insertPayload["habit_tracker_id"] = trackerId
        insertPayload["day"] = day
        request.httpBody = try JSONSerialization.data(withJSONObject: insertPayload)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([HabitTrackerDayItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }
}
