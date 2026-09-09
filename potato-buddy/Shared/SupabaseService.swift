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
            URLQueryItem(name: "select",    value: "id,title,category,priority,createdat"),
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

    /// 오늘 걸음 마일스톤 젤리 수령 (마일스톤당 1일 1회)
    func awardJellyForStepMilestone(milestoneSteps: Int) async throws -> Int {
        guard let milestone = StepCounterConstants.jellyMilestones.first(where: { $0.steps == milestoneSteps }) else {
            throw NSError(domain: "SupabaseService", code: -1, userInfo: [NSLocalizedDescriptionKey: "알 수 없는 걸음 마일스톤입니다."])
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        let day = formatter.string(from: Date())

        let jelly = try await awardJelly(
            amount: milestone.jellyAmount,
            reason: JellyRewardReason.stepMilestone,
            idempotencyKey: "step:\(day):\(milestoneSteps)"
        )

        if jelly.alreadyAwarded {
            return 0
        }
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
            URLQueryItem(name: "select",    value: "id,title,category,priority,createdat"),
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

    private static let diarySelectColumns = "id,date,content,image_url,image_prompt,emotion,four_cut_url,four_cut_scene_urls,cover_image_url,attached_images"

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
            URLQueryItem(name: "select",  value: Self.diarySelectColumns),
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
            URLQueryItem(name: "select",  value: Self.diarySelectColumns),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([DiaryItem].self, from: data)
        return items.first
    }

    /// diaries 테이블에 대한 upsert 공통 실행부. 전달된 필드만 갱신되고(PostgREST 병합 upsert),
    /// 나머지 컬럼은 기존 값이 보존된다.
    private func upsertDiary(_ fields: [String: Any]) async throws -> DiaryItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/diaries")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer")

        let isoFormatter = ISO8601DateFormatter()
        var body = fields
        body["user_id"]    = userId
        body["updated_at"] = isoFormatter.string(from: Date())
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([DiaryItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    private func awardJellyForDiary(date: String) async throws -> Int {
        let jelly = try await awardJelly(
            amount: JellyRewardAmount.diaryWrite,
            reason: JellyRewardReason.diaryWrite,
            idempotencyKey: "diary:\(date)"
        )
        return jelly.awarded
    }

    // MARK: - 일기 저장 (글만)

    /// 이미지 관련 컬럼은 body에 넣지 않으므로 기존 이미지가 그대로 보존된다.
    func saveDiaryTextOnly(date: String, content: String) async throws -> (item: DiaryItem, awarded: Int) {
        let item = try await upsertDiary(["date": date, "content": content])
        let awarded = try await awardJellyForDiary(date: date)
        return (item, awarded)
    }

    // MARK: - 대문 이미지 선택 변경

    func updateDiaryCoverImage(date: String, coverImageUrl: String) async throws -> DiaryItem {
        try await upsertDiary(["date": date, "cover_image_url": coverImageUrl])
    }

    // MARK: - Storage 업로드

    /// Supabase Storage `images` 버킷에 바이너리를 직접 업로드하고 공개 URL을 반환한다.
    func uploadImageData(_ data: Data, folder: String, fileName: String, contentType: String = "image/png") async throws -> String {
        let (_, token) = await authInfo()
        let path = "\(folder)/\(fileName)"
        let url = URL(string: "\(Config.supabaseURL)/storage/v1/object/images/\(path)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.addValue(contentType, forHTTPHeaderField: "Content-Type")
        request.addValue("3600", forHTTPHeaderField: "x-upsert")
        request.httpBody = data

        let (respData, response) = try await fetch(request)
        try checkResponse(respData, response)
        return "\(Config.supabaseURL)/storage/v1/object/public/images/\(path)"
    }

    /// 원격 URL(OpenAI가 반환한 임시 URL) 또는 data: URI를 내려받아 Storage에 영구 저장한다.
    func downloadAndStoreRemoteImage(urlString: String, folder: String, fileName: String) async throws -> String {
        let imageData: Data
        if urlString.hasPrefix("data:") {
            guard let commaIndex = urlString.firstIndex(of: ","),
                  let decoded = Data(base64Encoded: String(urlString[urlString.index(after: commaIndex)...]))
            else {
                throw NSError(domain: "SupabaseService", code: -1,
                              userInfo: [NSLocalizedDescriptionKey: "이미지 데이터를 해석할 수 없습니다."])
            }
            imageData = decoded
        } else {
            guard let remoteURL = URL(string: urlString) else {
                throw NSError(domain: "SupabaseService", code: -1,
                              userInfo: [NSLocalizedDescriptionKey: "이미지 URL이 올바르지 않습니다."])
            }
            let (data, _) = try await URLSession.shared.data(from: remoteURL)
            imageData = data
        }
        return try await uploadImageData(imageData, folder: folder, fileName: fileName)
    }

    // MARK: - AI 그림일기 생성 (edge function: generate-image-huggingface)

    private struct GeneratedImageResponse: Decodable {
        let imageUrl: String
        let prompt: String?
        let emotion: String?
        let scene: String?
    }

    private struct FourCutPanel: Decodable {
        let beat: String?
        let timeLabel: String?
        let summary: String?
        let setting: String?
        let action: String?
    }

    private struct FourCutPlanResponse: Decodable {
        let emotion: String?
        let styleLock: String?
        let panels: [FourCutPanel]
    }

    /// 일기 diary 이미지 생성 edge function을 anon key로 직접 호출한다 (웹의 freeImageService.js와 동일한 인증 방식).
    private func callGenerateImageFunction(_ body: [String: Any]) async throws -> Data {
        let url = URL(string: "\(Config.supabaseURL)/functions/v1/generate-image-huggingface")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(Config.anonKey)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return data
    }

    private func finalizedPrompt(_ prompt: String) -> String {
        let lower = prompt.lowercased()
        if lower.contains("no text") { return prompt }
        return prompt + ", no text, no letters, no numbers, no watermark"
    }

    /// AI 1컷: 일기 본문을 그대로 넘겨 이미지 1장을 생성한다.
    func generateOneCutImage(date: String, content: String, isRegenerate: Bool, existingCoverImageUrl: String?) async throws -> (item: DiaryItem, tokensUsed: Int, awarded: Int) {
        let tokenInfo = try await getMyAiTokenInfo()
        guard tokenInfo.balance >= tokenInfo.generationCost else {
            throw NSError(domain: "SupabaseService", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "AI 토큰이 부족합니다. (필요 \(tokenInfo.generationCost), 보유 \(tokenInfo.balance))"])
        }

        let responseData = try await callGenerateImageFunction(["diaryContent": content])
        let generated = try JSONDecoder().decode(GeneratedImageResponse.self, from: responseData)

        let timestamp = Int(Date().timeIntervalSince1970)
        let fileName = isRegenerate ? "\(date)-\(timestamp).png" : "\(date).png"
        let storedUrl = try await downloadAndStoreRemoteImage(urlString: generated.imageUrl, folder: "diaries", fileName: fileName)

        _ = try await consumeAiTokens(amount: tokenInfo.generationCost)

        var fields: [String: Any] = [
            "date": date,
            "content": content,
            "image_url": storedUrl,
        ]
        if let prompt = generated.prompt { fields["image_prompt"] = prompt }
        if let emotion = generated.emotion { fields["emotion"] = emotion }
        if existingCoverImageUrl == nil || existingCoverImageUrl?.isEmpty == true {
            fields["cover_image_url"] = storedUrl
        }

        let item = try await upsertDiary(fields)
        let awarded = try await awardJellyForDiary(date: date)
        return (item, tokenInfo.generationCost, awarded)
    }

    static let fourCutTokenCost = 10

    /// AI 4컷 장면 4장을 생성해 Storage에 저장하고 토큰을 소비한다.
    /// 스트립 합성(UIKit 필요)과 최종 diaries 저장은 호출부(iOS UI 레이어)의 몫이다 — 이 파일은 macOS 타겟에도 공유되므로 UIKit에 의존하지 않는다.
    func generateFourCutSceneUrls(
        date: String, content: String,
        onProgress: @escaping (Int, Int) -> Void
    ) async throws -> (sceneUrls: [String], tokenCost: Int) {
        let tokenInfo = try await getMyAiTokenInfo()
        guard tokenInfo.balance >= Self.fourCutTokenCost else {
            throw NSError(domain: "SupabaseService", code: -2,
                          userInfo: [NSLocalizedDescriptionKey: "AI 토큰이 부족합니다. (필요 \(Self.fourCutTokenCost), 보유 \(tokenInfo.balance))"])
        }

        var panelPrompts: [String] = []
        if let planData = try? await callGenerateImageFunction(["action": "plan_four_cut", "diaryContent": content]),
           let plan = try? JSONDecoder().decode(FourCutPlanResponse.self, from: planData),
           !plan.panels.isEmpty {
            let styleLock = plan.styleLock ?? "Posili the same cute round bear character every panel, crayon and colored-pencil style, thick black outlines, soft pastel palette"
            for (index, panel) in plan.panels.prefix(4).enumerated() {
                let timeLabel = panel.timeLabel ?? "장면 \(index + 1)"
                let summary = panel.summary ?? panel.beat ?? "오늘 하루의 한 장면"
                let setting = panel.setting ?? ""
                let action = panel.action ?? ""
                panelPrompts.append(finalizedPrompt(
                    "\(styleLock). Panel \(index + 1) of 4 in a chronological photo-booth diary story (\(timeLabel))." +
                    " Scene: \(summary). Setting: \(setting). Action: \(action)." +
                    " Keep the same character and art style consistent across all 4 panels. Single scene only, no collage, no grid, no multiple panels within one image."
                ))
            }
        }
        if panelPrompts.isEmpty {
            // 기획(plan) 호출 실패 시 시간 흐름을 나타내는 고정 4장면으로 대체
            let fallbackHints = ["아침, 하루의 시작", "낮, 하루 동안의 일", "저녁, 그날의 감정", "밤, 하루를 마무리"]
            for hint in fallbackHints {
                panelPrompts.append(finalizedPrompt(
                    "Posili the same cute round bear character, crayon and colored-pencil style, thick black outlines, soft pastel palette." +
                    " A single scene representing: \(hint), inspired by this diary: \(String(content.prefix(300)))." +
                    " Single scene only, no collage, no grid, no multiple panels within one image."
                ))
            }
        }

        var sceneUrls: [String] = []
        let timestamp = Int(Date().timeIntervalSince1970)
        for (index, prompt) in panelPrompts.enumerated() {
            let responseData = try await callGenerateImageFunction(["imagePrompt": prompt])
            let generated = try JSONDecoder().decode(GeneratedImageResponse.self, from: responseData)
            let storedUrl = try await downloadAndStoreRemoteImage(
                urlString: generated.imageUrl, folder: "diaries",
                fileName: "\(date)-scene\(index + 1)-\(timestamp).png"
            )
            sceneUrls.append(storedUrl)
            onProgress(sceneUrls.count, panelPrompts.count)
        }
        guard !sceneUrls.isEmpty else {
            throw NSError(domain: "SupabaseService", code: -3,
                          userInfo: [NSLocalizedDescriptionKey: "그림을 생성하지 못했습니다. 다시 시도해 주세요."])
        }

        _ = try await consumeAiTokens(amount: Self.fourCutTokenCost)
        return (sceneUrls, Self.fourCutTokenCost)
    }

    /// 사진 4컷 원본 사진들을 Storage에 업로드한다 (스트립 합성 전 단계). 토큰을 쓰지 않는다.
    func uploadPhotoFourCutSources(date: String, photos: [Data]) async throws -> [String] {
        guard !photos.isEmpty else {
            throw NSError(domain: "SupabaseService", code: -4,
                          userInfo: [NSLocalizedDescriptionKey: "사진을 1장 이상 선택해 주세요."])
        }
        let timestamp = Int(Date().timeIntervalSince1970)
        var photoUrls: [String] = []
        for (index, data) in photos.prefix(4).enumerated() {
            let url = try await uploadImageData(data, folder: "diaries", fileName: "\(date)-photo\(index + 1)-\(timestamp).jpg", contentType: "image/jpeg")
            photoUrls.append(url)
        }
        return photoUrls
    }

    /// 4컷(AI/사진 공통) 최종 저장: 이미 합성·업로드된 스트립 URL과 장면 URL들을 diaries 행에 반영한다.
    func finalizeFourCutDiary(
        date: String, content: String,
        sceneUrls: [String], stripUrl: String,
        attachedImages: [String]? = nil,
        existingCoverImageUrl: String?
    ) async throws -> (item: DiaryItem, awarded: Int) {
        var fields: [String: Any] = [
            "date": date,
            "content": content,
            "image_url": sceneUrls[0],
            "four_cut_url": stripUrl,
            "four_cut_scene_urls": sceneUrls,
        ]
        if let attachedImages {
            fields["attached_images"] = attachedImages
        }
        if existingCoverImageUrl == nil || existingCoverImageUrl?.isEmpty == true {
            fields["cover_image_url"] = sceneUrls[0]
        }

        let item = try await upsertDiary(fields)
        let awarded = try await awardJellyForDiary(date: date)
        return (item, awarded)
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

        if categories.isEmpty {
            return CategoryConstants.localFallbackList()
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
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
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

        do {
            var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events")!
            components.queryItems = [
                URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                URLQueryItem(name: "schedule_date", value: "lte.\(range.end)"),
                URLQueryItem(name: "select", value: "id,schedule_date,end_date,title,tag,repeat_type,repeat_interval,repeat_weekdays,repeat_monthly_rule,repeat_month_day,repeat_nth,repeat_weekday,repeat_end_type,repeat_count,repeat_until"),
                URLQueryItem(name: "order", value: "schedule_date.asc,created_at.asc"),
            ]
            var request = URLRequest(url: components.url!)
            headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
            let (data, response) = try await fetch(request)
            try checkResponse(data, response)
            let masters = try JSONDecoder().decode([ScheduleItem].self, from: data)
            let relevant = masters.filter { item in
                if item.isRecurring {
                    if item.resolvedRepeatEndType == .until,
                       let until = item.repeatUntil,
                       !until.isEmpty {
                        return until >= range.start
                    }
                    return true
                }
                return item.resolvedEndDate >= range.start
            }
            let exceptions = (try? await fetchExceptions(
                userId: userId, token: token, range: range
            )) ?? []
            return relevant
                .flatMap { ScheduleDateHelper.expand($0, rangeStart: range.start, rangeEnd: range.end, exceptions: exceptions) }
                .sorted {
                    if $0.scheduleDate != $1.scheduleDate {
                        return $0.scheduleDate < $1.scheduleDate
                    }
                    return $0.title < $1.title
                }
        } catch {
            return try await fetchSchedulesLegacy(userId: userId, token: token, range: range)
        }
    }

    private func fetchSchedulesLegacy(
        userId: String,
        token: String,
        range: (start: String, end: String)
    ) async throws -> [ScheduleItem] {
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
        tag: String,
        repeatType: String = ScheduleRepeatType.none.rawValue,
        repeatInterval: Int = 1,
        repeatWeekdays: [Int] = [],
        repeatMonthlyRule: String = ScheduleMonthlyRule.day.rawValue,
        repeatMonthDay: Int? = nil,
        repeatNth: Int? = nil,
        repeatWeekday: Int? = nil,
        repeatEndType: String = ScheduleRepeatEndType.never.rawValue,
        repeatCount: Int? = nil,
        repeatUntil: String? = nil
    ) async throws -> ScheduleItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let safeRepeat = ScheduleRepeatType.normalize(repeatType).rawValue
        let safeEndType: String = {
            if safeRepeat == ScheduleRepeatType.none.rawValue {
                return ScheduleRepeatEndType.never.rawValue
            }
            return ScheduleRepeatEndType.normalize(repeatEndType).rawValue
        }()

        var body: [String: Any] = [
            "user_id": userId,
            "schedule_date": scheduleDate,
            "end_date": endDate,
            "title": title,
            "tag": tag,
            "repeat_type": safeRepeat,
            "repeat_interval": max(1, repeatInterval),
            "repeat_end_type": safeEndType,
            "repeat_monthly_rule": ScheduleMonthlyRule.normalize(repeatMonthlyRule).rawValue,
        ]

        if safeRepeat == ScheduleRepeatType.weekly.rawValue {
            let days = repeatWeekdays.sorted()
            body["repeat_weekdays"] = days.map(String.init).joined(separator: ",")
        }

        if safeRepeat == ScheduleRepeatType.monthly.rawValue {
            let rule = ScheduleMonthlyRule.normalize(repeatMonthlyRule)
            body["repeat_monthly_rule"] = rule.rawValue
            if rule == .day {
                body["repeat_month_day"] = repeatMonthDay
                    ?? Int(scheduleDate.split(separator: "-").last.map(String.init) ?? "1")
                    ?? 1
            }
            if rule == .nthWeekday {
                body["repeat_nth"] = repeatNth ?? 1
                body["repeat_weekday"] = repeatWeekday ?? 1
            }
            if rule == .lastWeekday {
                body["repeat_weekday"] = repeatWeekday ?? 1
            }
        }

        if safeRepeat != ScheduleRepeatType.none.rawValue {
            if safeEndType == ScheduleRepeatEndType.until.rawValue,
               let until = repeatUntil,
               !until.isEmpty {
                body["repeat_until"] = until
            }
            if safeEndType == ScheduleRepeatEndType.count.rawValue,
               let count = repeatCount,
               count > 0 {
                body["repeat_count"] = count
            }
        }

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

    func updateSchedule(
        id: String,
        scheduleDate: String,
        endDate: String,
        title: String,
        tag: String,
        repeatType: String = ScheduleRepeatType.none.rawValue,
        repeatInterval: Int = 1,
        repeatWeekdays: [Int] = [],
        repeatMonthlyRule: String = ScheduleMonthlyRule.day.rawValue,
        repeatMonthDay: Int? = nil,
        repeatNth: Int? = nil,
        repeatWeekday: Int? = nil,
        repeatEndType: String = ScheduleRepeatEndType.never.rawValue,
        repeatCount: Int? = nil,
        repeatUntil: String? = nil
    ) async throws -> ScheduleItem {
        let (userId, token) = await authInfo()

        let masterId: String = {
            if let range = id.range(of: "__") {
                return String(id[..<range.lowerBound])
            }
            return id
        }()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events?id=eq.\(masterId)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let safeRepeat = ScheduleRepeatType.normalize(repeatType).rawValue
        let safeEndType: String = {
            if safeRepeat == ScheduleRepeatType.none.rawValue {
                return ScheduleRepeatEndType.never.rawValue
            }
            return ScheduleRepeatEndType.normalize(repeatEndType).rawValue
        }()

        var body: [String: Any] = [
            "schedule_date": scheduleDate,
            "end_date": endDate,
            "title": title,
            "tag": tag,
            "repeat_type": safeRepeat,
            "repeat_interval": max(1, repeatInterval),
            "repeat_end_type": safeEndType,
            "repeat_monthly_rule": ScheduleMonthlyRule.normalize(repeatMonthlyRule).rawValue,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]

        if safeRepeat == ScheduleRepeatType.weekly.rawValue {
            body["repeat_weekdays"] = repeatWeekdays.sorted().map(String.init).joined(separator: ",")
        } else {
            body["repeat_weekdays"] = NSNull()
        }

        if safeRepeat == ScheduleRepeatType.monthly.rawValue {
            let rule = ScheduleMonthlyRule.normalize(repeatMonthlyRule)
            body["repeat_monthly_rule"] = rule.rawValue
            if rule == .day {
                body["repeat_month_day"] = repeatMonthDay
                    ?? Int(scheduleDate.split(separator: "-").last.map(String.init) ?? "1")
                    ?? 1
                body["repeat_nth"] = NSNull()
                body["repeat_weekday"] = NSNull()
            } else if rule == .nthWeekday {
                body["repeat_nth"] = repeatNth ?? 1
                body["repeat_weekday"] = repeatWeekday ?? 1
                body["repeat_month_day"] = NSNull()
            } else if rule == .lastWeekday {
                body["repeat_weekday"] = repeatWeekday ?? 1
                body["repeat_month_day"] = NSNull()
                body["repeat_nth"] = NSNull()
            } else {
                body["repeat_month_day"] = NSNull()
                body["repeat_nth"] = NSNull()
                body["repeat_weekday"] = NSNull()
            }
        } else {
            body["repeat_month_day"] = NSNull()
            body["repeat_nth"] = NSNull()
            body["repeat_weekday"] = NSNull()
        }

        if safeRepeat != ScheduleRepeatType.none.rawValue {
            if safeEndType == ScheduleRepeatEndType.until.rawValue,
               let until = repeatUntil,
               !until.isEmpty {
                body["repeat_until"] = until
            } else {
                body["repeat_until"] = NSNull()
            }

            if safeEndType == ScheduleRepeatEndType.count.rawValue,
               let count = repeatCount,
               count > 0 {
                body["repeat_count"] = count
            } else {
                body["repeat_count"] = NSNull()
            }
        } else {
            body["repeat_until"] = NSNull()
            body["repeat_count"] = NSNull()
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ScheduleItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    func deleteSchedule(id: String) async throws {
        let (userId, token) = await authInfo()
        let masterId: String = {
            if let range = id.range(of: "__") {
                return String(id[..<range.lowerBound])
            }
            return id
        }()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events?id=eq.\(masterId)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        _ = try await fetch(request)
    }

    // MARK: - 반복 일정 예외

    private func fetchExceptions(
        userId: String,
        token: String,
        range: (start: String, end: String)
    ) async throws -> [ScheduleException] {
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/schedule_exceptions")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "occurrence_date", value: "gte.\(range.start)"),
            URLQueryItem(name: "occurrence_date", value: "lte.\(range.end)"),
            URLQueryItem(name: "select", value: "id,master_id,occurrence_date,is_deleted,title,tag,schedule_date,end_date"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return (try? JSONDecoder().decode([ScheduleException].self, from: data)) ?? []
    }

    /// 이 발생분만 삭제 (is_deleted = true 예외 삽입)
    func deleteThisOccurrence(id: String) async throws {
        let (userId, token) = await authInfo()
        let (masterId, occurrenceDate) = splitOccurrenceId(id)

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_exceptions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        let body: [String: Any] = [
            "user_id": userId,
            "master_id": masterId,
            "occurrence_date": occurrenceDate,
            "is_deleted": true,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await fetch(request)
    }

    /// 이 발생분 이후 모두 삭제 (repeat_until을 하루 전으로 설정)
    func deleteThisAndFutureOccurrences(id: String) async throws {
        let (userId, token) = await authInfo()
        let (masterId, occurrenceDate) = splitOccurrenceId(id)

        guard let dayBefore = ScheduleDateHelper.addDays(occurrenceDate, -1) else { return }

        // 마스터 repeat_until 업데이트
        let masterUrl = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_calendar_events?id=eq.\(masterId)&user_id=eq.\(userId)")!
        var masterRequest = URLRequest(url: masterUrl)
        masterRequest.httpMethod = "PATCH"
        headers(token: token).forEach { masterRequest.addValue($1, forHTTPHeaderField: $0) }
        let masterBody: [String: Any] = [
            "repeat_end_type": "until",
            "repeat_until": dayBefore,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        masterRequest.httpBody = try JSONSerialization.data(withJSONObject: masterBody)
        _ = try await fetch(masterRequest)

        // 이후 예외 삭제
        let excUrl = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_exceptions?master_id=eq.\(masterId)&user_id=eq.\(userId)&occurrence_date=gte.\(occurrenceDate)")!
        var excRequest = URLRequest(url: excUrl)
        excRequest.httpMethod = "DELETE"
        headers(token: token).forEach { excRequest.addValue($1, forHTTPHeaderField: $0) }
        _ = try await fetch(excRequest)
    }

    /// 이 발생분의 제목·태그·날짜 변경
    func updateThisOccurrence(id: String, title: String, tag: String, scheduleDate: String? = nil, endDate: String? = nil) async throws {
        let (userId, token) = await authInfo()
        let (masterId, occurrenceDate) = splitOccurrenceId(id)

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/schedule_exceptions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        var body: [String: Any] = [
            "user_id": userId,
            "master_id": masterId,
            "occurrence_date": occurrenceDate,
            "is_deleted": false,
            "title": title,
            "tag": tag,
        ]
        if let scheduleDate {
            body["schedule_date"] = scheduleDate
        }
        if let endDate {
            body["end_date"] = endDate
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        _ = try await fetch(request)
    }

    private func splitOccurrenceId(_ id: String) -> (masterId: String, occurrenceDate: String) {
        if let range = id.range(of: "__") {
            return (String(id[..<range.lowerBound]), String(id[range.upperBound...]))
        }
        return (id, "")
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
        let todayKey = ScheduleDateHelper.dayFormatter.string(from: Date())
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
            URLQueryItem(name: "select", value: "id,trip_id,item_date,start_minute,end_minute,title,memo,place_name,place_address,place_lat,place_lng,google_place_id"),
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
        memo: String?,
        placeName: String? = nil,
        placeAddress: String? = nil,
        placeLat: Double? = nil,
        placeLng: Double? = nil,
        googlePlaceId: String? = nil
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
        applyPlaceFields(
            to: &body,
            placeName: placeName,
            placeAddress: placeAddress,
            placeLat: placeLat,
            placeLng: placeLng,
            googlePlaceId: googlePlaceId
        )
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
        memo: String?,
        placeName: String? = nil,
        placeAddress: String? = nil,
        placeLat: Double? = nil,
        placeLng: Double? = nil,
        googlePlaceId: String? = nil
    ) async throws -> AbroadItineraryItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_itinerary_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "item_date": itemDate,
            "start_minute": startMinute,
            "end_minute": endMinute,
            "title": title,
            "memo": memo ?? "",
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        applyPlaceFields(
            to: &body,
            placeName: placeName,
            placeAddress: placeAddress,
            placeLat: placeLat,
            placeLng: placeLng,
            googlePlaceId: googlePlaceId
        )
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadItineraryItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    private func applyPlaceFields(
        to body: inout [String: Any],
        placeName: String?,
        placeAddress: String?,
        placeLat: Double?,
        placeLng: Double?,
        googlePlaceId: String?
    ) {
        let name = placeName?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let address = placeAddress?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let placeId = googlePlaceId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        body["place_name"] = name.isEmpty ? NSNull() : name
        body["place_address"] = address.isEmpty ? NSNull() : address
        body["google_place_id"] = placeId.isEmpty ? NSNull() : placeId
        if let placeLat, let placeLng {
            body["place_lat"] = placeLat
            body["place_lng"] = placeLng
        } else {
            body["place_lat"] = NSNull()
            body["place_lng"] = NSNull()
        }
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

    // MARK: - 해외 여행 준비물

    func fetchAbroadPackingItems(tripId: String) async throws -> [AbroadPackingItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_packing_items")!
        components.queryItems = [
            URLQueryItem(name: "trip_id", value: "eq.\(tripId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,trip_id,title,is_checked,sort_order"),
            URLQueryItem(name: "order", value: "sort_order.asc,created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([AbroadPackingItem].self, from: data)
    }

    func createAbroadPackingItem(tripId: String, title: String) async throws -> AbroadPackingItem {
        let (userId, token) = await authInfo()
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "준비물 이름을 입력해주세요."])
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_packing_items")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "trip_id": tripId,
            "user_id": userId,
            "title": trimmed,
            "is_checked": false,
            "sort_order": Int(Date().timeIntervalSince1970) % 1_000_000_000,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadPackingItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateAbroadPackingItem(id: String, title: String?, isChecked: Bool?) async throws -> AbroadPackingItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_packing_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let title {
            let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "준비물 이름을 입력해주세요."])
            }
            body["title"] = trimmed
        }
        if let isChecked {
            body["is_checked"] = isChecked
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadPackingItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteAbroadPackingItem(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_packing_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 해외 여행 기념품

    func fetchAbroadSouvenirItems(tripId: String) async throws -> [AbroadSouvenirItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_souvenir_items")!
        components.queryItems = [
            URLQueryItem(name: "trip_id", value: "eq.\(tripId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,trip_id,title,is_checked,sort_order"),
            URLQueryItem(name: "order", value: "sort_order.asc,created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([AbroadSouvenirItem].self, from: data)
    }

    func createAbroadSouvenirItem(tripId: String, title: String) async throws -> AbroadSouvenirItem {
        let (userId, token) = await authInfo()
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "기념품 이름을 입력해주세요."])
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_souvenir_items")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "trip_id": tripId,
            "user_id": userId,
            "title": trimmed,
            "is_checked": false,
            "sort_order": Int(Date().timeIntervalSince1970) % 1_000_000_000,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadSouvenirItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateAbroadSouvenirItem(id: String, title: String?, isChecked: Bool?) async throws -> AbroadSouvenirItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_souvenir_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let title {
            let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "기념품 이름을 입력해주세요."])
            }
            body["title"] = trimmed
        }
        if let isChecked {
            body["is_checked"] = isChecked
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadSouvenirItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteAbroadSouvenirItem(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_souvenir_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 해외 여행 예비 일정

    func fetchAbroadSpareItems(tripId: String) async throws -> [AbroadSpareItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_spare_items")!
        components.queryItems = [
            URLQueryItem(name: "trip_id", value: "eq.\(tripId)"),
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,trip_id,title,sort_order"),
            URLQueryItem(name: "order", value: "sort_order.asc,created_at.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([AbroadSpareItem].self, from: data)
    }

    func createAbroadSpareItem(tripId: String, title: String) async throws -> AbroadSpareItem {
        let (userId, token) = await authInfo()
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "예비 일정 제목을 입력해주세요."])
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_spare_items")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "trip_id": tripId,
            "user_id": userId,
            "title": trimmed,
            "sort_order": Int(Date().timeIntervalSince1970) % 1_000_000_000,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadSpareItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateAbroadSpareItem(id: String, title: String) async throws -> AbroadSpareItem {
        let (userId, token) = await authInfo()
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw NSError(domain: "SupabaseService", code: 400, userInfo: [NSLocalizedDescriptionKey: "예비 일정 제목을 입력해주세요."])
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_spare_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "title": trimmed,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([AbroadSpareItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteAbroadSpareItem(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/travel_abroad_spare_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 공부 세션

    /// 공부 세션 저장 후 10분당 젤리 1개 지급. 세션 ID로 웹/앱 중복 지급 방지.
    /// - Returns: 이번에 지급된 젤리 수
    @discardableResult
    func addStudySession(seconds: Int, source: String, category: String = StudyTimerCategory.study.rawValue) async throws -> Int {
        let (userId, token) = await authInfo()
        guard seconds > 0 else { return 0 }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let today = formatter.string(from: Date())

        let safeCategory = StudyTimerCategory.normalize(category).rawValue

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/study_sessions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id":          userId,
            "study_date":       today,
            "duration_seconds": seconds,
            "source":           source,
            "category":         safeCategory,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        struct InsertedSession: Decodable {
            let id: String
        }
        let sessions = try JSONDecoder().decode([InsertedSession].self, from: data)
        guard let sessionId = sessions.first?.id else { return 0 }

        let jellyAmount = StudyTimerJelly.amount(forSeconds: seconds)
        guard jellyAmount > 0 else { return 0 }

        do {
            let jelly = try await awardJelly(
                amount: jellyAmount,
                reason: JellyRewardReason.studyTimer,
                idempotencyKey: "study_session:\(sessionId)"
            )
            return jelly.alreadyAwarded ? 0 : jelly.awarded
        } catch {
            // 세션 저장은 성공했으므로 젤리 실패는 삼킴
            print("타이머 젤리 지급 실패: \(error.localizedDescription)")
            return 0
        }
    }

    /// 최근 N개월 공부 세션 전체 조회
    func fetchStudySessions(months: Int = 6) async throws -> [StudySessionItem] {
        let (userId, token) = await authInfo()

        let calendar = Calendar(identifier: .gregorian)
        let now = Date()
        guard let startDate = calendar.date(byAdding: .month, value: -(months - 1), to: now) else { return [] }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let startStr = formatter.string(from: calendar.date(
            from: calendar.dateComponents([.year, .month], from: startDate))!)
        let endStr = formatter.string(from: now)

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/study_sessions")!
        components.queryItems = [
            URLQueryItem(name: "user_id",    value: "eq.\(userId)"),
            URLQueryItem(name: "study_date", value: "gte.\(startStr)"),
            URLQueryItem(name: "study_date", value: "lte.\(endStr)"),
            URLQueryItem(name: "select",     value: "id,study_date,duration_seconds,source,category"),
            URLQueryItem(name: "order",      value: "study_date.desc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([StudySessionItem].self, from: data)
    }

    /// 특정 월 공부 세션 조회 (달력용)
    func fetchStudySessionsForMonth(year: Int, month: Int) async throws -> [StudySessionItem] {
        let (userId, token) = await authInfo()

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        let startStr = String(format: "%04d-%02d-01", year, month)
        let lastDay = Calendar(identifier: .gregorian).range(
            of: .day, in: .month,
            for: formatter.date(from: startStr)!)!.count
        let endStr = String(format: "%04d-%02d-%02d", year, month, lastDay)

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/study_sessions")!
        components.queryItems = [
            URLQueryItem(name: "user_id",    value: "eq.\(userId)"),
            URLQueryItem(name: "study_date", value: "gte.\(startStr)"),
            URLQueryItem(name: "study_date", value: "lte.\(endStr)"),
            URLQueryItem(name: "select",     value: "id,study_date,duration_seconds,source,category"),
            URLQueryItem(name: "order",      value: "study_date.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([StudySessionItem].self, from: data)
    }

    // MARK: - 생리 주기 설정 조회

    func getMenstrualSettings() async throws -> MenstrualSettings {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/menstrual_cycle_settings")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "cycle_length,period_length,is_enabled,onboarding_completed"),
            URLQueryItem(name: "limit", value: "1"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        struct Row: Decodable {
            let cycle_length: Int?
            let period_length: Int?
            let is_enabled: Bool?
            let onboarding_completed: Bool?
        }
        if let rows = try? JSONDecoder().decode([Row].self, from: data), let row = rows.first {
            return MenstrualSettings(
                cycleLength: row.cycle_length ?? 28,
                periodLength: row.period_length ?? 5,
                isEnabled: row.is_enabled ?? true,
                onboardingCompleted: row.onboarding_completed ?? false
            )
        }
        return .defaultSettings
    }

    // MARK: - 생리 주기 설정 저장

    func saveMenstrualSettings(cycleLength: Int, periodLength: Int) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/menstrual_cycle_settings")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates,return=minimal", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "cycle_length": cycleLength,
            "period_length": periodLength,
            "onboarding_completed": true,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 생리 기록 조회

    func getMenstrualRecords(year: Int, month: Int) async throws -> [MenstrualPeriodRecord] {
        let (userId, token) = await authInfo()

        let range = ScheduleDateHelper.monthRange(year: year, month: month)

        // 해당 월에 걸치는 기록 조회 (시작일 기준 ±45일 여유)
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let start = formatter.date(from: range.start),
              let expandedStart = Calendar(identifier: .gregorian).date(byAdding: .day, value: -45, to: start)
        else { return [] }
        let expandedStartStr = formatter.string(from: expandedStart)

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/menstrual_period_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "start_date", value: "gte.\(expandedStartStr)"),
            URLQueryItem(name: "select", value: "id,start_date,end_date,notes"),
            URLQueryItem(name: "order", value: "start_date.asc"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([MenstrualPeriodRecord].self, from: data)
    }

    // MARK: - 생리 시작일 기록

    func recordPeriodStart(startDate: String, periodLength: Int) async throws -> MenstrualPeriodRecord {
        let (userId, token) = await authInfo()

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let start = formatter.date(from: startDate),
              let endDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: periodLength - 1, to: start)
        else { throw URLError(.badURL) }
        let endDateStr = formatter.string(from: endDate)

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/menstrual_period_records")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "start_date": startDate,
            "end_date": endDateStr,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([MenstrualPeriodRecord].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    // MARK: - 생리 기록 삭제

    func deleteMenstrualRecord(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/menstrual_period_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 토익 단어 Day 완료 기록

    // MARK: - 토익 단어 카탈로그

    func fetchToeicVocabCatalog() async throws -> [ToeicVocabCatalogRow] {
        let (_, token) = await authInfo()
        let pageSize = 1000
        var offset = 0
        var all: [ToeicVocabCatalogRow] = []

        while true {
            var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/toeic_vocab_catalog")!
            components.queryItems = [
                URLQueryItem(name: "select", value: "sort_order,en,ko"),
                URLQueryItem(name: "order", value: "sort_order.asc"),
                URLQueryItem(name: "offset", value: "\(offset)"),
                URLQueryItem(name: "limit", value: "\(pageSize)"),
            ]

            var request = URLRequest(url: components.url!)
            headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

            let (data, response) = try await fetch(request)
            try checkResponse(data, response)

            let chunk = try JSONDecoder().decode([ToeicVocabCatalogRow].self, from: data)
            all.append(contentsOf: chunk)
            if chunk.count < pageSize { break }
            offset += pageSize
        }

        return all
    }

    // MARK: - 토익 Day 완료

    private struct ToeicDayCompletionRow: Decodable {
        let dayNumber: Int
        let completionCount: Int

        enum CodingKeys: String, CodingKey {
            case dayNumber = "day_number"
            case completionCount = "completion_count"
        }
    }

    func fetchToeicDayCompletions() async throws -> [Int: Int] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/toeic_vocab_day_completions")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "day_number,completion_count"),
        ]

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        let rows = try JSONDecoder().decode([ToeicDayCompletionRow].self, from: data)
        var map: [Int: Int] = [:]
        for row in rows {
            let count = max(0, row.completionCount)
            if count > 0 { map[row.dayNumber] = count }
        }
        return map
    }

    func setToeicDayCompletion(dayNumber: Int, completionCount: Int) async throws -> Int {
        let (userId, token) = await authInfo()
        let count = max(0, completionCount)

        if count <= 0 {
            var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/toeic_vocab_day_completions")!
            components.queryItems = [
                URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                URLQueryItem(name: "day_number", value: "eq.\(dayNumber)"),
            ]
            var request = URLRequest(url: components.url!)
            request.httpMethod = "DELETE"
            headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
            request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
            let (data, response) = try await fetch(request)
            try checkResponse(data, response)
            return 0
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/toeic_vocab_day_completions")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("resolution=merge-duplicates,return=representation", forHTTPHeaderField: "Prefer")

        let iso = ISO8601DateFormatter().string(from: Date())
        let body: [String: Any] = [
            "user_id": userId,
            "day_number": dayNumber,
            "completion_count": count,
            "updated_at": iso,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let rows = try JSONDecoder().decode([ToeicDayCompletionRow].self, from: data)
        return max(0, rows.first?.completionCount ?? count)
    }

    func incrementToeicDayCompletion(dayNumber: Int) async throws -> Int {
        let map = try await fetchToeicDayCompletions()
        let next = (map[dayNumber] ?? 0) + 1
        return try await setToeicDayCompletion(dayNumber: dayNumber, completionCount: next)
    }

    func decrementToeicDayCompletion(dayNumber: Int) async throws -> Int {
        let map = try await fetchToeicDayCompletions()
        let next = max(0, (map[dayNumber] ?? 0) - 1)
        return try await setToeicDayCompletion(dayNumber: dayNumber, completionCount: next)
    }

    // MARK: - 냉장고 재고

    func fetchFridgeItems(zone: String? = nil, status: String) async throws -> [FridgeItem] {
        let (userId, token) = await authInfo()

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/fridge_items")!
        var queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "status", value: "eq.\(status)"),
            URLQueryItem(name: "select", value: "id,zone,name,quantity,status,registered_at,expires_at"),
            URLQueryItem(name: "order", value: "expires_at.asc.nullslast,registered_at.desc"),
        ]
        if let zone {
            queryItems.insert(URLQueryItem(name: "zone", value: "eq.\(zone)"), at: 1)
        }
        components.queryItems = queryItems

        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([FridgeItem].self, from: data)
    }

    // MARK: - AI 토큰

    struct AiTokenInfo: Decodable {
        let balance: Int
        let generationCost: Int
        let backlogAssistantCost: Int

        enum CodingKeys: String, CodingKey {
            case balance
            case generationCost
            case generation_cost
            case backlogAssistantCost
            case backlog_assistant_cost
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            balance = try c.decodeIfPresent(Int.self, forKey: .balance) ?? 0
            let gc1 = try c.decodeIfPresent(Int.self, forKey: .generationCost)
            let gc2 = try c.decodeIfPresent(Int.self, forKey: .generation_cost)
            generationCost = gc1 ?? gc2 ?? 3
            let bac1 = try c.decodeIfPresent(Int.self, forKey: .backlogAssistantCost)
            let bac2 = try c.decodeIfPresent(Int.self, forKey: .backlog_assistant_cost)
            backlogAssistantCost = bac1 ?? bac2 ?? 1
        }
    }

    func getMyAiTokenInfo() async throws -> AiTokenInfo {
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/rpc/get_my_ai_token_info")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: [:])

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode(AiTokenInfo.self, from: data)
    }

    func consumeAiTokens(amount: Int) async throws -> Int {
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/rpc/consume_ai_tokens")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "p_amount": amount,
        ])

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        if let value = try? JSONDecoder().decode(Int.self, from: data) {
            return value
        }
        if let wrapped = try? JSONDecoder().decode([Int].self, from: data), let first = wrapped.first {
            return first
        }
        throw NSError(
            domain: "SupabaseService",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "토큰 차감 응답을 해석하지 못했습니다."]
        )
    }

    func createFridgeItem(
        zone: String,
        name: String,
        quantity: Int,
        registeredAt: String,
        expiresAt: String?,
        status: String = FridgeItemStatus.active.rawValue
    ) async throws -> FridgeItem {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/fridge_items")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let safeQuantity = max(1, quantity)
        var body: [String: Any] = [
            "user_id": userId,
            "zone": zone,
            "name": name.trimmingCharacters(in: .whitespacesAndNewlines),
            "quantity": safeQuantity,
            "status": status,
            "registered_at": registeredAt,
        ]
        if let expiresAt, !expiresAt.isEmpty {
            body["expires_at"] = expiresAt
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([FridgeItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    func updateFridgeItem(
        id: String,
        zone: String? = nil,
        name: String? = nil,
        quantity: Int? = nil,
        status: String? = nil,
        registeredAt: String? = nil,
        expiresAt: String?? = nil
    ) async throws -> FridgeItem {
        let (userId, token) = await authInfo()

        var payload: [String: Any] = [
            "updated_at": ISO8601DateFormatter().string(from: Date()),
        ]
        if let zone { payload["zone"] = zone }
        if let name { payload["name"] = name.trimmingCharacters(in: .whitespacesAndNewlines) }
        if let quantity { payload["quantity"] = max(1, quantity) }
        if let status { payload["status"] = status }
        if let registeredAt { payload["registered_at"] = registeredAt }
        if let expiresAt {
            if let value = expiresAt, !value.isEmpty {
                payload["expires_at"] = value
            } else {
                payload["expires_at"] = NSNull()
            }
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/fridge_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([FridgeItem].self, from: data)
        guard let item = items.first else {
            throw URLError(.badServerResponse)
        }
        return item
    }

    func deleteFridgeItem(id: String) async throws {
        let (userId, token) = await authInfo()

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/fridge_items?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 프로젝트 기록

    func fetchProjectCounts() async throws -> [ProjectCountItem] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/project_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "projectname"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        struct NameRow: Decodable {
            let projectname: String
        }
        let rows = try JSONDecoder().decode([NameRow].self, from: data)
        var counts: [String: Int] = [:]
        for row in rows {
            counts[row.projectname, default: 0] += 1
        }
        return counts
            .map { ProjectCountItem(projectName: $0.key, count: $0.value) }
            .sorted { $0.projectName.localizedStandardCompare($1.projectName) == .orderedAscending }
    }

    func fetchProjectNames() async throws -> [String] {
        try await fetchProjectCounts().map(\.projectName)
    }

    func fetchProjectRecords(projectName: String) async throws -> [ProjectRecordItem] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/project_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "projectname", value: "eq.\(projectName)"),
            URLQueryItem(name: "select", value: "id,projectname,type,date,title,background,is_main"),
            URLQueryItem(name: "order", value: "date.desc,createdat.desc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([ProjectRecordItem].self, from: data)
    }

    func fetchMainProjectRecord(projectName: String) async throws -> ProjectRecordItem? {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/project_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "projectname", value: "eq.\(projectName)"),
            URLQueryItem(name: "is_main", value: "eq.true"),
            URLQueryItem(name: "select", value: "id,projectname,type,date,title,background,is_main"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([ProjectRecordItem].self, from: data).first
    }

    func createProjectRecord(
        projectName: String,
        date: String,
        title: String,
        content: String,
        isMain: Bool = false
    ) async throws -> ProjectRecordItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/project_records")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "user_id": userId,
            "projectname": projectName.trimmingCharacters(in: .whitespacesAndNewlines),
            "type": "MEETING",
            "date": date,
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "background": content.isEmpty ? NSNull() : content,
            "discussion": NSNull(),
            "problem": NSNull(),
            "decision": NSNull(),
            "actionitems": NSNull(),
            "is_main": isMain,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ProjectRecordItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateProjectRecord(
        id: String,
        projectName: String,
        date: String,
        title: String,
        content: String
    ) async throws -> ProjectRecordItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/project_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "projectname": projectName.trimmingCharacters(in: .whitespacesAndNewlines),
            "date": date,
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "background": content.isEmpty ? NSNull() : content,
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ProjectRecordItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteProjectRecord(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/project_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    /// 프로젝트당 메인 기록 1개 — 기존 메인 해제 후 지정
    func setMainProjectRecord(id: String, projectName: String) async throws {
        let (userId, token) = await authInfo()

        var clearComponents = URLComponents(string: "\(Config.supabaseURL)/rest/v1/project_records")!
        clearComponents.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "projectname", value: "eq.\(projectName)"),
            URLQueryItem(name: "is_main", value: "eq.true"),
        ]
        var clearRequest = URLRequest(url: clearComponents.url!)
        clearRequest.httpMethod = "PATCH"
        headers(token: token).forEach { clearRequest.addValue($1, forHTTPHeaderField: $0) }
        clearRequest.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        clearRequest.httpBody = try JSONSerialization.data(withJSONObject: ["is_main": false])
        let (clearData, clearResponse) = try await fetch(clearRequest)
        try checkResponse(clearData, clearResponse)

        let setURL = URL(string: "\(Config.supabaseURL)/rest/v1/project_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var setRequest = URLRequest(url: setURL)
        setRequest.httpMethod = "PATCH"
        headers(token: token).forEach { setRequest.addValue($1, forHTTPHeaderField: $0) }
        setRequest.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        setRequest.httpBody = try JSONSerialization.data(withJSONObject: ["is_main": true])
        let (setData, setResponse) = try await fetch(setRequest)
        try checkResponse(setData, setResponse)
    }

    func unsetMainProjectRecord(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/project_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["is_main": false])
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    // MARK: - 독서 (책 / 기록)

    func fetchBooks() async throws -> [BookItem] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/books")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "select", value: "id,title,author,publisher,isbn,thumbnail_url,description,page_count,published_date,api_source,api_id,is_completed,one_line_insight,completed_at"),
            URLQueryItem(name: "order", value: "created_at.desc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([BookItem].self, from: data)
    }

    func createBook(
        title: String,
        author: String?,
        publisher: String?,
        isbn: String?,
        thumbnailUrl: String?,
        description: String?,
        pageCount: Int?,
        publishedDate: String?,
        apiSource: String?,
        apiId: String?
    ) async throws -> BookItem {
        let (userId, token) = await authInfo()

        if let isbn, !isbn.isEmpty {
            var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/books")!
            components.queryItems = [
                URLQueryItem(name: "user_id", value: "eq.\(userId)"),
                URLQueryItem(name: "isbn", value: "eq.\(isbn)"),
                URLQueryItem(name: "select", value: "id,title,author,publisher,isbn,thumbnail_url,description,page_count,published_date,api_source,api_id,is_completed,one_line_insight,completed_at"),
                URLQueryItem(name: "limit", value: "1"),
            ]
            var existingReq = URLRequest(url: components.url!)
            headers(token: token).forEach { existingReq.addValue($1, forHTTPHeaderField: $0) }
            let (existingData, existingResponse) = try await fetch(existingReq)
            try checkResponse(existingData, existingResponse)
            let existing = try JSONDecoder().decode([BookItem].self, from: existingData)
            if let first = existing.first {
                return first
            }
        }

        let url = URL(string: "\(Config.supabaseURL)/rest/v1/books")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "user_id": userId,
            "title": title,
        ]
        if let author, !author.isEmpty { body["author"] = author }
        if let publisher, !publisher.isEmpty { body["publisher"] = publisher }
        if let isbn, !isbn.isEmpty { body["isbn"] = isbn }
        if let thumbnailUrl, !thumbnailUrl.isEmpty { body["thumbnail_url"] = thumbnailUrl }
        if let description, !description.isEmpty { body["description"] = description }
        if let pageCount, pageCount > 0 { body["page_count"] = pageCount }
        if let publishedDate, !publishedDate.isEmpty { body["published_date"] = publishedDate }
        if let apiSource, !apiSource.isEmpty { body["api_source"] = apiSource }
        if let apiId, !apiId.isEmpty { body["api_id"] = apiId }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([BookItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateBookCompletion(bookId: String, isCompleted: Bool, oneLineInsight: String?) async throws -> BookItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/books?id=eq.\(bookId)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: Date())

        var body: [String: Any] = [
            "is_completed": isCompleted,
            "updated_at": ISO8601DateFormatter().string(from: Date()),
            "completed_at": isCompleted ? today : NSNull(),
        ]
        if let oneLineInsight {
            body["one_line_insight"] = oneLineInsight.isEmpty ? NSNull() : oneLineInsight
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([BookItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func fetchReadingRecords(bookId: String) async throws -> [ReadingRecordItem] {
        let (userId, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/reading_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "book_id", value: "eq.\(bookId)"),
            URLQueryItem(name: "select", value: "id,book_id,reading_date,start_time,end_time,reading_minutes,pages_read,notes"),
            URLQueryItem(name: "order", value: "reading_date.desc"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([ReadingRecordItem].self, from: data)
    }

    func createReadingRecord(
        bookId: String,
        readingDate: String,
        pagesRead: Int?,
        notes: String?
    ) async throws -> ReadingRecordItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/reading_records")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        var body: [String: Any] = [
            "user_id": userId,
            "book_id": bookId,
            "reading_date": readingDate,
        ]
        if let pagesRead, pagesRead > 0 { body["pages_read"] = pagesRead }
        if let notes, !notes.isEmpty { body["notes"] = notes }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ReadingRecordItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func updateReadingRecord(
        id: String,
        readingDate: String,
        pagesRead: Int?,
        notes: String?
    ) async throws -> ReadingRecordItem {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/reading_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=representation", forHTTPHeaderField: "Prefer")

        let body: [String: Any] = [
            "reading_date": readingDate,
            "pages_read": pagesRead ?? NSNull(),
            "notes": (notes?.isEmpty == false) ? notes! : NSNull(),
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        let items = try JSONDecoder().decode([ReadingRecordItem].self, from: data)
        guard let item = items.first else { throw URLError(.badServerResponse) }
        return item
    }

    func deleteReadingRecord(id: String) async throws {
        let (userId, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/reading_records?id=eq.\(id)&user_id=eq.\(userId)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.addValue("return=minimal", forHTTPHeaderField: "Prefer")
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
    }

    func fetchMonthlyReadingStats(year: Int, month: Int) async throws -> MonthlyReadingStats {
        let (userId, token) = await authInfo()
        let start = String(format: "%04d-%02d-01", year, month)
        let calendar = Calendar(identifier: .gregorian)
        var comps = DateComponents()
        comps.year = year
        comps.month = month
        comps.day = 1
        guard let startDate = calendar.date(from: comps),
              let endDate = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startDate)
        else {
            return MonthlyReadingStats(totalBooks: 0, totalSessions: 0, totalMinutes: 0)
        }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let end = formatter.string(from: endDate)

        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/reading_records")!
        components.queryItems = [
            URLQueryItem(name: "user_id", value: "eq.\(userId)"),
            URLQueryItem(name: "and", value: "(reading_date.gte.\(start),reading_date.lte.\(end))"),
            URLQueryItem(name: "select", value: "id,book_id,reading_minutes"),
        ]
        var request = URLRequest(url: components.url!)
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        struct Row: Decodable {
            let id: String
            let bookId: String
            let readingMinutes: Int?
            enum CodingKeys: String, CodingKey {
                case id
                case bookId = "book_id"
                case readingMinutes = "reading_minutes"
            }
        }
        let rows = try JSONDecoder().decode([Row].self, from: data)
        let books = Set(rows.map(\.bookId)).count
        let minutes = rows.reduce(0) { $0 + ($1.readingMinutes ?? 0) }
        return MonthlyReadingStats(totalBooks: books, totalSessions: rows.count, totalMinutes: minutes)
    }

    /// Google Books → 실패 시 Open Library (웹과 동일)
    func searchBooks(query: String) async throws -> [BookSearchResult] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }

        let google = try await searchBooksGoogle(query: q)
        if !google.isEmpty { return google }
        return try await searchBooksOpenLibrary(query: q)
    }

    private func searchBooksGoogle(query: String) async throws -> [BookSearchResult] {
        var components = URLComponents(string: "https://www.googleapis.com/books/v1/volumes")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "maxResults", value: "20"),
            URLQueryItem(name: "langRestrict", value: "ko"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return []
        }

        struct GoogleResponse: Decodable {
            let items: [GoogleItem]?
        }
        struct GoogleItem: Decodable {
            let id: String
            let volumeInfo: VolumeInfo?
        }
        struct VolumeInfo: Decodable {
            let title: String?
            let authors: [String]?
            let publisher: String?
            let description: String?
            let pageCount: Int?
            let publishedDate: String?
            let imageLinks: ImageLinks?
            let industryIdentifiers: [IndustryId]?
        }
        struct ImageLinks: Decodable {
            let thumbnail: String?
            let smallThumbnail: String?
        }
        struct IndustryId: Decodable {
            let type: String?
            let identifier: String?
        }

        let decoded = try? JSONDecoder().decode(GoogleResponse.self, from: data)
        return (decoded?.items ?? []).map { item in
            let info = item.volumeInfo
            let isbn13 = info?.industryIdentifiers?.first(where: { $0.type == "ISBN_13" })?.identifier
            let isbn10 = info?.industryIdentifiers?.first(where: { $0.type == "ISBN_10" })?.identifier
            return BookSearchResult(
                apiId: item.id,
                title: info?.title ?? "",
                author: info?.authors?.joined(separator: ", ") ?? "",
                publisher: info?.publisher ?? "",
                isbn: isbn13 ?? isbn10 ?? "",
                thumbnailUrl: info?.imageLinks?.thumbnail ?? info?.imageLinks?.smallThumbnail ?? "",
                description: info?.description ?? "",
                pageCount: info?.pageCount ?? 0,
                publishedDate: info?.publishedDate ?? "",
                apiSource: "google_books"
            )
        }.filter { !$0.title.isEmpty }
    }

    private func searchBooksOpenLibrary(query: String) async throws -> [BookSearchResult] {
        guard query.count >= 3 else { return [] }
        var components = URLComponents(string: "https://openlibrary.org/search.json")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "limit", value: "20"),
        ]
        var request = URLRequest(url: components.url!)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            return []
        }

        struct OLResponse: Decodable { let docs: [OLDoc]? }
        struct OLDoc: Decodable {
            let key: String?
            let cover_edition_key: String?
            let cover_i: Int?
            let title: String?
            let author_name: [String]?
            let publisher: [String]?
            let isbn: [String]?
            let number_of_pages_median: Int?
            let first_publish_year: Int?
        }

        let decoded = try? JSONDecoder().decode(OLResponse.self, from: data)
        return (decoded?.docs ?? []).compactMap { doc in
            let title = doc.title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !title.isEmpty else { return nil }
            let isbns = doc.isbn ?? []
            let isbn13 = isbns.first { $0.replacingOccurrences(of: "-", with: "").count == 13 }
            let isbn10 = isbns.first { $0.replacingOccurrences(of: "-", with: "").count == 10 }
            let apiId = doc.key ?? doc.cover_edition_key ?? (doc.cover_i.map { "cover:\($0)" } ?? title)
            let thumb = doc.cover_i.map { "https://covers.openlibrary.org/b/id/\($0)-M.jpg" } ?? ""
            return BookSearchResult(
                apiId: apiId,
                title: title,
                author: doc.author_name?.joined(separator: ", ") ?? "",
                publisher: doc.publisher?.first ?? "",
                isbn: isbn13 ?? isbn10 ?? isbns.first ?? "",
                thumbnailUrl: thumb,
                description: "",
                pageCount: doc.number_of_pages_median ?? 0,
                publishedDate: doc.first_publish_year.map(String.init) ?? "",
                apiSource: "open_library"
            )
        }
    }
}
