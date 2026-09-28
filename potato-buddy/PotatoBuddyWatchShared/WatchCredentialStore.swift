import Foundation

/// 폰에서 전달받은 로그인 정보
struct WatchCredentials: Codable, Equatable, Sendable {
    let userId: String
    let accessToken: String
}

/// 워치 로그인 정보 저장소 (App Group 공유 → 컴플리케이션에서도 사용)
enum WatchCredentialStore {
    private static let key = "watch.credentials"

    static func load() -> WatchCredentials? {
        guard let data = WatchConstants.sharedDefaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(WatchCredentials.self, from: data)
    }

    static func save(_ credentials: WatchCredentials) {
        guard let data = try? JSONEncoder().encode(credentials) else { return }
        WatchConstants.sharedDefaults.set(data, forKey: key)
    }

    static func clear() {
        WatchConstants.sharedDefaults.removeObject(forKey: key)
    }
}
