import Foundation

/// 포실이 성장(농장) API — 웹 `src/services/farmService.js`와 동일한 RPC를 호출한다.
extension SupabaseService {
    // MARK: - 조회

    /// 내 포실이 성장 상태
    func getMyFarmProgress() async throws -> FarmProgress {
        let data = try await callFarmRpc("get_my_farm_progress", body: [:])
        return try JSONDecoder().decode(FarmProgress.self, from: data)
    }

    /// 먹이 주기 이벤트(획득 경험치·가능 단계)
    func getMilkFeedEvent() async throws -> FarmMilkEvent? {
        let (_, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/farm_xp_events")!
        components.queryItems = [
            URLQueryItem(name: "event_key", value: "eq.\(FarmConstants.milkEventKey)"),
            URLQueryItem(name: "is_active", value: "eq.true"),
            URLQueryItem(name: "select", value: "xp_amount,min_stage,max_stage"),
            URLQueryItem(name: "limit", value: "1"),
        ]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return try JSONDecoder().decode([FarmMilkEvent].self, from: data).first
    }

    /// 농장 설정(단계별 이미지·먹이 젤리 비용)
    func getFarmSettingsMap() async throws -> [String: String] {
        let (_, token) = await authInfo()
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/farm_settings")!
        components.queryItems = [URLQueryItem(name: "select", value: "key,value")]
        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)

        struct Row: Decodable {
            let key: String
            let value: String?
        }
        let rows = try JSONDecoder().decode([Row].self, from: data)
        return Dictionary(rows.compactMap { row in row.value.map { (row.key, $0) } },
                          uniquingKeysWith: { _, last in last })
    }

    // MARK: - 먹이 주기

    /// 먹이 1회
    func feedMilk() async throws -> FarmFeedResult {
        let data = try await callFarmRpc(
            "process_farm_xp_event",
            body: ["p_event_key": FarmConstants.milkEventKey, "p_idempotency_key": NSNull()]
        )
        let response = try JSONDecoder().decode(FarmFeedResponse.self, from: data)
        return FarmFeedResult(
            feedCount: (response.xpAwarded > 0 || response.leveledUp) ? 1 : 0,
            xpAwarded: response.xpAwarded,
            jellySpent: response.jellySpent,
            leveledUp: response.leveledUp,
            stage: response.stage,
            seedGranted: response.seedGranted
        )
    }

    /// 보유 젤리로 최대 횟수만큼 먹이기. RPC가 아직 DB에 없으면 1회씩 반복 호출한다.
    func feedMilkMax(maxCount: Int) async throws -> FarmFeedResult {
        let limit = min(max(maxCount, 0), FarmConstants.maxFeedBatch)
        guard limit >= 1 else { return FarmFeedResult() }

        do {
            let data = try await callFarmRpc("feed_farm_milk_max", body: ["p_max_count": limit])
            let response = try JSONDecoder().decode(FarmFeedResponse.self, from: data)
            return FarmFeedResult(
                feedCount: response.feedCount ?? 0,
                xpAwarded: response.xpAwarded,
                jellySpent: response.jellySpent,
                leveledUp: response.leveledUp,
                stage: response.stage,
                seedGranted: response.seedGranted
            )
        } catch let error as NSError where Self.isMissingFarmRpc(error) {
            return try await feedMilkRepeatedly(limit: limit)
        }
    }

    private func feedMilkRepeatedly(limit: Int) async throws -> FarmFeedResult {
        var total = FarmFeedResult()
        for _ in 0..<limit {
            let result: FarmFeedResult
            do {
                result = try await feedMilk()
            } catch {
                if total.feedCount == 0 { throw error }
                break
            }
            guard result.feedCount > 0 else { break }

            total.feedCount += 1
            total.xpAwarded += result.xpAwarded
            total.jellySpent += result.jellySpent
            total.seedGranted += result.seedGranted
            if result.leveledUp {
                total.leveledUp = true
                total.stage = result.stage ?? total.stage
                if (result.stage ?? 0) >= FarmConstants.maxStage { break }
            }
        }
        return total
    }

    // MARK: - 내부

    private func callFarmRpc(_ name: String, body: [String: Any]) async throws -> Data {
        let (_, token) = await authInfo()
        let url = URL(string: "\(Config.supabaseURL)/rest/v1/rpc/\(name)")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        headers(token: token).forEach { request.addValue($1, forHTTPHeaderField: $0) }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await fetch(request)
        try checkResponse(data, response)
        return data
    }

    /// RPC가 DB에 없을 때(PostgREST 404 / PGRST202)
    private static func isMissingFarmRpc(_ error: NSError) -> Bool {
        guard error.domain == "SupabaseService" else { return false }
        let message = error.localizedDescription
        return error.code == 404
            || message.contains("PGRST202")
            || message.contains("Could not find")
    }
}
