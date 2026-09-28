import Foundation

// MARK: - 공유 알림 이름

extension Notification.Name {
    static let authStateChanged = Notification.Name("authStateChanged")
    /// 로그인·토큰 갱신·로그아웃으로 세션 값이 바뀜 (애플워치 동기화용)
    static let authSessionUpdated = Notification.Name("authSessionUpdated")
}
