import Foundation

@MainActor
final class AuthService: ObservableObject {
    static let shared = AuthService()

    @Published var isLoggedIn: Bool = false
    @Published var userId: String = ""
    @Published var accessToken: String = ""

    private let defaults = UserDefaults.standard
    private let tokenKey        = "pb_accessToken"
    private let refreshTokenKey = "pb_refreshToken"
    private let userIdKey       = "pb_userId"

    private init() {
        if let token = defaults.string(forKey: tokenKey),
           let uid   = defaults.string(forKey: userIdKey),
           !token.isEmpty, !uid.isEmpty {
            self.accessToken = token
            self.userId      = uid
            self.isLoggedIn  = true
        }
    }

    // MARK: - 토큰 갱신

    func refreshSession() async throws {
        guard let refreshToken = defaults.string(forKey: refreshTokenKey), !refreshToken.isEmpty else {
            signOut()
            throw AuthError.invalidCredentials
        }

        let url = URL(string: "\(Config.supabaseURL)/auth/v1/token?grant_type=refresh_token")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            signOut()
            throw AuthError.invalidCredentials
        }

        let decoded = try JSONDecoder().decode(AuthResponse.self, from: data)
        self.accessToken = decoded.accessToken
        self.userId      = decoded.user.id
        self.isLoggedIn  = true

        defaults.set(decoded.accessToken, forKey: tokenKey)
        defaults.set(decoded.user.id, forKey: userIdKey)
        if let rt = decoded.refreshToken {
            defaults.set(rt, forKey: refreshTokenKey)
        }
    }

    // MARK: - 회원가입

    func signUp(email: String, password: String) async throws {
        let url = URL(string: "\(Config.supabaseURL)/auth/v1/signup")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue(Config.anonKey, forHTTPHeaderField: "apikey")
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "email": email,
            "password": password,
            "options": ["emailRedirectTo": Config.websiteURL.absoluteString]
        ]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AuthError.signUpFailed
        }

        // 에러 응답 처리
        if http.statusCode != 200 {
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let msg = (json["msg"] as? String) ?? (json["message"] as? String) ?? (json["error_description"] as? String) {
                throw AuthError.custom(msg)
            }
            throw AuthError.signUpFailed
        }

        // 이메일 인증이 필요하므로 로그인 시도하지 않음
        // needsEmailConfirmation 에러를 throw해서 UI에서 안내 메시지 표시
        throw AuthError.needsEmailConfirmation
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
        if let rt = decoded.refreshToken {
            defaults.set(rt, forKey: refreshTokenKey)
        }
    }

    // MARK: - 외부 세션 저장 (웹 로그인 콜백)

    func saveSession(accessToken: String, userId: String) {
        self.accessToken = accessToken
        self.userId      = userId
        self.isLoggedIn  = true
        defaults.set(accessToken, forKey: tokenKey)
        defaults.set(userId, forKey: userIdKey)
    }

    // MARK: - 로그아웃

    func signOut() {
        accessToken = ""
        userId      = ""
        isLoggedIn  = false
        defaults.removeObject(forKey: tokenKey)
        defaults.removeObject(forKey: refreshTokenKey)
        defaults.removeObject(forKey: userIdKey)
    }
}

// MARK: - 에러

enum AuthError: LocalizedError {
    case invalidCredentials
    case signUpFailed
    case needsEmailConfirmation
    case custom(String)
    var errorDescription: String? {
        switch self {
        case .invalidCredentials:     return "이메일 또는 비밀번호가 올바르지 않습니다."
        case .signUpFailed:           return "회원가입에 실패했습니다."
        case .needsEmailConfirmation: return "needsEmailConfirmation"
        case .custom(let msg):        return msg
        }
    }
}

// MARK: - 응답 모델

private struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String?
    let user: AuthUser
    enum CodingKeys: String, CodingKey {
        case accessToken  = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

private struct AuthUser: Decodable {
    let id: String
}
