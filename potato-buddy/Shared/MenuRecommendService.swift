import Foundation

struct RecommendedMenu: Identifiable, Hashable {
    let id: String
    let title: String
    let reason: String
    let usedIngredients: [String]
    let missingIngredients: [String]
    let steps: [String]
}

enum MenuRecommendService {
    private static let model = "gpt-4o-mini"
    private static let maxTokens = 1800
    private static let menuCountMin = 3
    private static let menuCountMax = 5

    private static let systemPrompt = """
    당신은 한국어로 답하는 가정용 요리 메뉴 추천 어시스턴트입니다.
    사용자의 냉장실·냉동고·실온에 있는 보관중 재료를 최대한 활용해 현실적인 집밥 메뉴를 제안하세요.

    규칙:
    1. 반드시 JSON 객체만 반환합니다. 마크다운/설명 문장 금지.
    2. menus 배열에 \(menuCountMin)~\(menuCountMax)개의 메뉴를 넣습니다.
    3. 각 메뉴는 title, reason, usedIngredients, missingIngredients, steps 필드를 가집니다.
    4. usedIngredients: 현재 재고에서 실제로 쓰는 재료명 배열
    5. missingIngredients: 없으면 아쉬운 재료(조미료·기본 양념 위주, 최대 3개). 없으면 빈 배열
    6. steps: 간단 조리 단계 2~5개 문자열 배열
    7. 유통기한이 임박하거나 지난 재료를 우선 소비하는 메뉴를 선호하세요.
    8. 재고가 적을 때는 간단·적은 재료 메뉴를 제안하세요.

    JSON 스키마:
    {
      "menus": [
        {
          "title": "메뉴명",
          "reason": "추천 이유 한 문장",
          "usedIngredients": ["재료1"],
          "missingIngredients": ["부족재료"],
          "steps": ["1단계", "2단계"]
        }
      ]
    }
    """

    static func buildContext(from items: [FridgeItem]) -> String {
        let lines = items.map { item -> String in
            let zone = FridgeZone(rawValue: item.zone)?.label ?? item.zone
            let expiry = (item.expiresAt?.isEmpty == false) ? "유통기한 \(item.expiresAt!)" : "유통기한 없음"
            return "- [\(zone)] \(item.name) ×\(item.quantity) (\(expiry))"
        }
        return "보관중 재료 목록:\n" + lines.joined(separator: "\n")
    }

    static func recommendMenus(from items: [FridgeItem]) async throws -> (menus: [RecommendedMenu], remainingBalance: Int) {
        let apiKey = Config.openAIAPIKey
        guard !apiKey.isEmpty else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "OpenAI API 키가 설정되지 않았습니다. (Info.plist OPENAI_API_KEY)"]
            )
        }
        guard !items.isEmpty else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "보관중 재료가 없습니다. 재료를 먼저 등록해 주세요."]
            )
        }

        let tokenInfo = try await SupabaseService.shared.getMyAiTokenInfo()
        let cost = Config.menuRecommendTokenCost
        guard tokenInfo.balance >= cost else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "AI 토큰이 부족합니다. (보유: \(tokenInfo.balance), 필요: \(cost))"]
            )
        }

        let context = buildContext(from: items)
        let userContent = """
        아래 재고로 집밥 메뉴 \(menuCountMin)~\(menuCountMax)개를 추천해 주세요.

        \(context)
        """

        let body: [String: Any] = [
            "model": model,
            "response_format": ["type": "json_object"],
            "messages": [
                ["role": "system", "content": systemPrompt],
                ["role": "user", "content": userContent],
            ],
            "max_tokens": maxTokens,
            "temperature": 0.7,
        ]

        var request = URLRequest(url: URL(string: "https://api.openai.com/v1/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["error"] as? [String: Any] }?
                .flatMap { $0["message"] as? String }
            throw NSError(
                domain: "MenuRecommendService",
                code: http.statusCode,
                userInfo: [NSLocalizedDescriptionKey: message ?? "메뉴 추천에 실패했습니다."]
            )
        }

        let decoded = try JSONDecoder().decode(OpenAIChatResponse.self, from: data)
        guard let content = decoded.choices.first?.message.content, !content.isEmpty else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "AI 응답이 비어 있습니다."]
            )
        }

        let menus = try parseMenus(from: content)
        guard !menus.isEmpty else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "추천 메뉴를 만들지 못했습니다. 다시 시도해 주세요."]
            )
        }

        let remaining = try await SupabaseService.shared.consumeAiTokens(amount: cost)
        return (menus, remaining)
    }

    private static func parseMenus(from content: String) throws -> [RecommendedMenu] {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        let jsonData: Data
        if let data = trimmed.data(using: .utf8),
           (try? JSONSerialization.jsonObject(with: data)) != nil {
            jsonData = data
        } else if let start = trimmed.firstIndex(of: "{"),
                  let end = trimmed.lastIndex(of: "}"),
                  start < end {
            jsonData = Data(trimmed[start...end].utf8)
        } else {
            throw NSError(
                domain: "MenuRecommendService",
                code: -1,
                userInfo: [NSLocalizedDescriptionKey: "AI 응답을 해석하지 못했습니다."]
            )
        }

        let payload = try JSONDecoder().decode(MenuRecommendPayload.self, from: jsonData)
        let stamp = Int(Date().timeIntervalSince1970)
        return payload.menus.prefix(menuCountMax).enumerated().compactMap { index, item in
            let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty else { return nil }
            return RecommendedMenu(
                id: "menu-\(stamp)-\(index)",
                title: title,
                reason: item.reason?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "",
                usedIngredients: (item.usedIngredients ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty },
                missingIngredients: Array((item.missingIngredients ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.prefix(3)),
                steps: Array((item.steps ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.prefix(5))
            )
        }
    }
}

private struct OpenAIChatResponse: Decodable {
    struct Choice: Decodable {
        struct Message: Decodable {
            let content: String?
        }
        let message: Message
    }
    let choices: [Choice]
}

private struct MenuRecommendPayload: Decodable {
    struct Menu: Decodable {
        let title: String
        let reason: String?
        let usedIngredients: [String]?
        let missingIngredients: [String]?
        let steps: [String]?
    }
    let menus: [Menu]
}
