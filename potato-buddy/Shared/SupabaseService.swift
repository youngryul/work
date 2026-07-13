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

    struct JellyAwardResult: Decodable {
        let balance: Int
        let awarded: Int
        let alreadyAwarded: Bool

        enum CodingKeys: String, CodingKey {
            case balance
            case awarded
            case alreadyAwarded
            case alreadyAwardedSnake = "already_awarded"
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            balance = try container.decodeIfPresent(Int.self, forKey: .balance) ?? 0
            awarded = try container.decodeIfPresent(Int.self, forKey: .awarded) ?? 0
            let camel = try container.decodeIfPresent(Bool.self, forKey: .alreadyAwarded)
            let snake = try container.decodeIfPresent(Bool.self, forKey: .alreadyAwardedSnake)
            alreadyAwarded = camel ?? snake ?? false
        }
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

    private func awardJelly(amount: Int, reason: String, idempotencyKey: String) async throws -> JellyAwardResult {
        let (_, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/rpc/award_jelly")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let body: [String: Any] = [
            "p_amount": amount,
            "p_reason": reason,
            "p_idempotency_key": idempotencyKey,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode(JellyAwardResult.self, from: data)
    }

    func getMyJellyBalance() async throws -> Int {
        let (_, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/rpc/get_my_jelly_balance")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: [:])

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        if let value = try? JSONDecoder().decode(Int.self, from: data) {
            return value
        }
        if let stringValue = String(data: data, encoding: .utf8),
           let value = Int(stringValue.trimmingCharacters(in: .whitespacesAndNewlines)) {
            return value
        }
        return 0
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

    func completeTask(id: String) async throws -> Int {
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

        let jelly = try await awardJelly(
            amount: JellyRewardAmount.taskComplete,
            reason: JellyRewardReason.taskComplete,
            idempotencyKey: "task:\(id):\(now)"
        )
        return jelly.awarded
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

        // 오늘 미완료 할일 중 최대 priority 조회 (맨 아래에 배치)
        var priorityComponents = URLComponents(string: "\(Config.supabaseURL)/rest/v1/tasks")!
        priorityComponents.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "istoday", value: "eq.true"),
            URLQueryItem(name: "completed", value: "eq.false"),
            URLQueryItem(name: "id", value: "neq.\(id)"),
            URLQueryItem(name: "select", value: "priority"),
        ]
        var priorityRequest = URLRequest(url: priorityComponents.url!)
        headers(token: token).forEach { priorityRequest.addValue($1, forHTTPHeaderField: $0) }
        let (priorityData, priorityResponse) = try await fetch(priorityRequest)
        try checkResponse(priorityData, priorityResponse)

        struct PriorityRow: Decodable { let priority: Int? }
        let priorityRows = (try? JSONDecoder().decode([PriorityRow].self, from: priorityData)) ?? []
        let maxPriority = priorityRows.compactMap(\.priority).max() ?? -1
        let nextPriority = maxPriority + 1

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/tasks?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        // 웹과 동일: movedtotodayat은 epoch 밀리초
        let now = Int(Date().timeIntervalSince1970 * 1000)
        let body: [String: Any] = [
            "istoday": true,
            "movedtotodayat": now,
            "priority": nextPriority,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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

    func saveDiary(date: String, content: String) async throws -> (item: DiaryItem, awarded: Int) {
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
        let jelly = try await awardJelly(
            amount: JellyRewardAmount.diaryWrite,
            reason: JellyRewardReason.diaryWrite,
            idempotencyKey: "diary:\(date)"
        )
        return (item, jelly.awarded)
    }

    // MARK: - 카테고리 조회 (웹과 동일)

    func fetchCategories() async throws -> [CategoryItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/categories")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,name,emoji"),
            URLQueryItem(name: "order", value: "name.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        var categories = try JSONDecoder().decode([CategoryItem].self, from: data)

        if categories.isEmpty {
            try await seedDefaultCategories(userId: userId, token: token)
            let (retryData, retryResponse) = try await fetch(request)
            try checkResponse(retryData, retryResponse)
            categories = try JSONDecoder().decode([CategoryItem].self, from: retryData)
        }

        if !categories.contains(where: { $0.name == CategoryConstants.systemDailyName }) {
            categories.insert(
                CategoryItem(
                    id: "system_daily",
                    name: CategoryConstants.systemDailyName,
                    emoji: CategoryConstants.systemDailyEmoji
                ),
                at: 0
            )
        }

        let defaultName = (try? await fetchDefaultCategoryName()) ?? CategoryConstants.fallbackDefaultName
        if defaultName != CategoryConstants.systemDailyName,
           let defaultIndex = categories.firstIndex(where: { $0.name == defaultName }),
           defaultIndex > 0 {
            let defaultCat = categories.remove(at: defaultIndex)
            let systemIndex = categories.firstIndex(where: { $0.name == CategoryConstants.systemDailyName }) ?? -1
            categories.insert(defaultCat, at: min(systemIndex + 1, categories.count))
        }

        return categories
    }

    func fetchDefaultCategoryName() async throws -> String {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/user_preferences")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "default_category"),
            URLQueryItem(name: "limit", value: "1"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        do {
            let (data, response) = try await fetch(request)
            try checkResponse(data, response)
            struct PreferenceRow: Decodable { let default_category: String? }
            let rows = try JSONDecoder().decode([PreferenceRow].self, from: data)
            if let name = rows.first?.default_category, !name.isEmpty {
                return name
            }
        } catch {
            // 설정 테이블이 없거나 비어 있으면 폴백
        }

        return CategoryConstants.fallbackDefaultName
    }

    private func seedDefaultCategories(userId: String, token: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/categories")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let body = CategoryConstants.defaultSeed.map { cat -> [String: String] in
            [
                "name": cat.name,
                "emoji": cat.emoji,
                "user_id": userId,
            ]
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await fetch(request)
    }

    // MARK: - 일정 태그 조회 (웹과 동일)

    func fetchOrCreateScheduleTags() async throws -> [ScheduleTagItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_tags")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,name,color"),
            URLQueryItem(name: "order", value: "created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let existing = try JSONDecoder().decode([ScheduleTagItem].self, from: data)
        if !existing.isEmpty {
            return existing
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_tags")!
        var insertRequest = URLRequest(url: url)
        insertRequest.httpMethod = "POST"
        headers(token: token).forEach { insertRequest.addValue($1, forHTTPHeaderField: $0) }
        insertRequest.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body = DefaultScheduleTags.seed.map { tag -> [String: String] in
            [
                "user_id": userId,
                "name": tag.name,
                "color": tag.color,
            ]
        }
        insertRequest.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (insertData, insertResponse) = try await fetch(insertRequest)
        try checkResponse(insertData, insertResponse)
        return try JSONDecoder().decode([ScheduleTagItem].self, from: insertData)
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
        year: Int,
        month: Int,
        day: Int,
        isCompleted: Bool
    ) async throws -> (item: HabitTrackerDayItem, awarded: Int) {
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
            let awarded = try await awardHabitTrackerJelly(
                trackerId: trackerId,
                year: year,
                month: month,
                day: day,
                isCompleted: isCompleted
            )
            return (item, awarded)
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
        let awarded = try await awardHabitTrackerJelly(
            trackerId: trackerId,
            year: year,
            month: month,
            day: day,
            isCompleted: isCompleted
        )
        return (item, awarded)
    }

    private func awardHabitTrackerJelly(
        trackerId: String,
        year: Int,
        month: Int,
        day: Int,
        isCompleted: Bool
    ) async throws -> Int {
        guard isCompleted else { return 0 }

        let dateKey = String(format: "%04d-%02d-%02d", year, month, day)
        let todayKey = ScheduleDateHelper.string(from: Date())
        let isToday = (dateKey == todayKey)
        let amount = isToday ? JellyRewardAmount.habitTrackerFirstToday : JellyRewardAmount.habitTrackerOther
        let idempotencyPrefix = isToday ? "habit_tracker" : "habit_tracker:other"

        let jelly = try await awardJelly(
            amount: amount,
            reason: JellyRewardReason.habitTrackerFirstToday,
            idempotencyKey: "\(idempotencyPrefix):\(trackerId):\(dateKey)"
        )
        return jelly.awarded
    }

    // MARK: - 해외 여행 일정

    func fetchAbroadTrips() async throws -> [AbroadTrip] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_trips")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,title,country_code,departure_at,return_at"),
            URLQueryItem(name: "order", value: "departure_at.desc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([AbroadTrip].self, from: data)
    }

    func createAbroadTrip(
        title: String,
        countryCode: String,
        departureAt: String,
        returnAt: String
    ) async throws -> AbroadTrip {
        let (userId, token) = await authInfo()
        let code = countryCode.uppercased()
        guard code != "KR" else {
            throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "해외 여행만 등록할 수 있습니다."])
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_trips")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "title": title,
            "country_code": code,
            "departure_at": departureAt,
            "return_at": returnAt,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadTrip].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteAbroadTrip(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_trips?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    func fetchAbroadItineraryItems(tripId: String, itemDate: String?) async throws -> [AbroadItineraryItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_itinerary_items")!
        var queryItems = [
            URLQueryItem(name: "trip_id", value: "eq.\(tripId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,trip_id,item_date,start_minute,end_minute,title,memo"),
            URLQueryItem(name: "order", value: "item_date.asc,start_minute.asc"),
        ]
        if let itemDate, !itemDate.isEmpty {
            queryItems.append(URLQueryItem(name: "item_date", value: "eq.\(itemDate)"))
        }
        components.queryItems = queryItems

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([AbroadItineraryItem].self, from: data)
    }

    func createAbroadItineraryItem(
        tripId: String,
        itemDate: String,
        startMinute: Int,
        endMinute: Int,
        title: String,
        memo: String?
    ) async throws -> AbroadItineraryItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_itinerary_items")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "trip_id": tripId,
            "user_id": userId,
            "item_date": itemDate,
            "start_minute": startMinute,
            "end_minute": endMinute,
            "title": title,
        ]
        if let memo, !memo.isEmpty {
            body["memo"] = memo
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadItineraryItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateAbroadItineraryItem(
        id: String,
        itemDate: String,
        startMinute: Int,
        endMinute: Int,
        title: String,
        memo: String?
    ) async throws -> AbroadItineraryItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_itinerary_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "item_date": itemDate,
            "start_minute": startMinute,
            "end_minute": endMinute,
            "title": title,
            "memo": memo ?? "",
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadItineraryItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteAbroadItineraryItem(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_itinerary_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }
}
