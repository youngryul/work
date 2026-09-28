import Foundation

// MARK: - 아이폰 ↔ 애플워치 WatchConnectivity 메시지 규약
//
// 아이폰 앱이 로그인 세션의 유일한 관리자이다.
// - 폰 → 워치: updateApplicationContext 로 현재 세션(access token)을 전달
// - 워치 → 폰: access token 이 만료되면 sendMessage 로 새 토큰을 요청
// 워치가 refresh token 으로 직접 갱신하면 Supabase 의 refresh token 재사용 감지에 걸려
// 폰 세션까지 끊길 수 있으므로, 갱신은 항상 폰에서만 수행한다.

enum WatchSyncKey {
    static let kind        = "kind"
    static let loggedIn    = "loggedIn"
    static let userId      = "userId"
    static let accessToken = "accessToken"
    static let sentAt      = "sentAt"
}

enum WatchSyncKind {
    /// 폰 → 워치: 현재 로그인 세션
    static let session        = "session"
    /// 워치 → 폰: 세션 요청 (accessToken 에 워치가 가진 만료 토큰을 담아 보냄)
    static let requestSession = "requestSession"
}

/// 폰이 워치로 보내는 세션 정보
struct WatchSessionPayload: Equatable {
    let loggedIn: Bool
    let userId: String
    let accessToken: String

    static let loggedOut = WatchSessionPayload(loggedIn: false, userId: "", accessToken: "")

    var dictionary: [String: Any] {
        [
            WatchSyncKey.kind:        WatchSyncKind.session,
            WatchSyncKey.loggedIn:    loggedIn,
            WatchSyncKey.userId:      userId,
            WatchSyncKey.accessToken: accessToken,
            // 동일한 내용이어도 applicationContext 가 다시 전달되도록 전송 시각 포함
            WatchSyncKey.sentAt:      Date().timeIntervalSince1970,
        ]
    }

    init(loggedIn: Bool, userId: String, accessToken: String) {
        self.loggedIn    = loggedIn
        self.userId      = userId
        self.accessToken = accessToken
    }

    init?(dictionary: [String: Any]) {
        guard dictionary[WatchSyncKey.kind] as? String == WatchSyncKind.session,
              let loggedIn = dictionary[WatchSyncKey.loggedIn] as? Bool else { return nil }
        self.loggedIn    = loggedIn
        self.userId      = dictionary[WatchSyncKey.userId] as? String ?? ""
        self.accessToken = dictionary[WatchSyncKey.accessToken] as? String ?? ""
    }
}
