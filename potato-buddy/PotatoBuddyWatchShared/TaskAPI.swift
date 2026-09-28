import Foundation

/// 오늘 할일 API (iOS SupabaseService 의 할일 부분과 동일한 쿼리)
struct TaskAPI: Sendable {
    let client: WatchAPIClient

    func fetchTodayTasks() async throws -> [TaskItem] {
        let data = try await client.send { credentials in
            try WatchAPIClient.restRequest(
                "tasks",
                query: [
                    URLQueryItem(name: "istoday",   value: "eq.true"),
                    URLQueryItem(name: "completed", value: "eq.false"),
                    URLQueryItem(name: "user_id",   value: "eq.\(credentials.userId)"),
                    URLQueryItem(name: "select",    value: "id,title,category,priority,createdat"),
                    URLQueryItem(name: "order",     value: "priority.asc,movedtotodayat.asc,createdat.asc"),
                ],
                credentials: credentials
            )
        }
        return try JSONDecoder().decode([TaskItem].self, from: data)
    }

    func completeTask(id: String) async throws {
        let now = Int(Date().timeIntervalSince1970 * 1000) // 밀리초

        _ = try await client.send { credentials in
            try WatchAPIClient.restRequest(
                "tasks",
                query: [
                    URLQueryItem(name: "id",      value: "eq.\(id)"),
                    URLQueryItem(name: "user_id", value: "eq.\(credentials.userId)"),
                ],
                method: "PATCH",
                body: ["completed": true, "completedat": now],
                prefer: "return=minimal",
                credentials: credentials
            )
        }

        // 폰과 동일하게 완료 보상 젤리 지급 (실패해도 완료 처리는 유지)
        _ = try? await client.send { credentials in
            try WatchAPIClient.restRequest(
                "rpc/award_jelly",
                method: "POST",
                body: [
                    "p_amount": JellyRewardAmount.taskComplete,
                    "p_reason": JellyRewardReason.taskComplete,
                    "p_idempotency_key": "task:\(id):\(now)",
                ],
                credentials: credentials
            )
        }
    }
}
