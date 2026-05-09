import Foundation

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isLoggedIn: Bool = false
    @Published var userId: String = ""
    @Published var accessToken: String = ""

    private let defaults = UserDefaults.standard
    private let tokenKey = "pb_accessToken"
    private let userIdKey = "pb_userId"

    private init() {
        if let token = defaults.string(forKey: tokenKey),
           let uid   = defaults.string(forKey: userIdKey),
           !token.isEmpty, !uid.isEmpty {
            self.accessToken = token
            self.userId      = uid
            self.isLoggedIn  = true
        }
    }

    // MARK: - 로그인

    func signIn(email: String, password: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/auth/v1/token?grant_type=password")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["email": email, "password": password]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw AuthError.invalidCredentials
        }

        let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)

        self.accessToken = decoded.accessToken
        self.userId      = decoded.user.id
        self.isLoggedIn  = true

        defaults.set(decoded.accessToken, forKey: tokenKey)
        defaults.set(decoded.user.id, forKey: userIdKey)
    }

    // MARK: - 로그아웃

    func signOut() {
        accessToken = ""
        userId      = ""
        isLoggedIn  = false
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: userIdKey)
    }
}

// MARK: - 에러

enum AuthError: LocalizedError {
    case invalidCredentials
    var errorDescription: String? {
        "이메일 또는 비밀번호가 올바르지 않습니다."
    }
}

// MARK: - 응답 모델

private struct AuthResponse: Decodable {
    let accessToken: String
    let user: AuthUser
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case user
    }
}

private struct AuthUser: Decodable {
    let id: String
}
