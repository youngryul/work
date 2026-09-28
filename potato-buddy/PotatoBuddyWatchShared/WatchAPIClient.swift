import Foundation

enum WatchAPIError: LocalizedError {
    case notLoggedIn
    case phoneUnreachable
    case http(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .notLoggedIn:      return "아이폰 포실이 앱에서 로그인해 주세요."
        case .phoneUnreachable: return "아이폰과 연결되지 않았어요."
        case .http(let status, let message): return "서버 오류 (\(status)): \(message)"
        }
    }
}

/// 워치용 Supabase REST 클라이언트
/// - 기능별 API(TaskAPI 등)는 이 클라이언트를 통해 요청한다.
/// - 401 이 오면 `refresher` 로 폰에서 새 토큰을 받아 1회 재시도한다.
///   (컴플리케이션처럼 폰과 통신할 수 없는 곳에서는 refresher 를 nil 로 둔다)
struct WatchAPIClient: Sendable {
    typealias TokenRefresher = @Sendable (_ staleToken: String) async throws -> WatchCredentials

    let refresher: TokenRefresher?

    init(refresher: TokenRefresher? = nil) {
        self.refresher = refresher
    }

    /// 인증 헤더를 붙여 요청하고 응답 본문을 반환
    /// - Parameter build: 로그인 정보를 받아 요청을 만드는 클로저 (재시도 시 새 토큰으로 다시 호출됨)
    func send(_ build: (WatchCredentials) throws -> URLRequest) async throws -> Data {
        guard let credentials = WatchCredentialStore.load() else { throw WatchAPIError.notLoggedIn }

        var (data, status) = try await perform(build(credentials))

        if status == 401, let refresher {
            let fresh = try await refresher(credentials.accessToken)
            (data, status) = try await perform(build(fresh))
        }

        guard (200..<300).contains(status) else {
            if status == 401 { throw WatchAPIError.notLoggedIn }
            let message = String(data: data, encoding: .utf8) ?? ""
            throw WatchAPIError.http(status: status, message: message)
        }
        return data
    }

    private func perform(_ request: URLRequest) async throws -> (Data, Int) {
        let (data, response) = try await URLSession.shared.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }

    // MARK: - 요청 생성 도우미

    /// `/rest/v1/{path}` 요청 생성
    static func restRequest(
        _ path: String,
        query: [URLQueryItem] = [],
        method: String = "GET",
        body: [String: Any]? = nil,
        prefer: String? = nil,
        credentials: WatchCredentials
    ) throws -> URLRequest {
        var components = URLComponents(string: "\(Config.supabaseURL)/rest/v1/\(path)")!
        if !query.isEmpty { components.queryItems = query }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.timeoutInterval = 20
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        if let prefer { request.addValue(prefer, forHTTPHeaderField: "Prefer") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        return request
    }
}
