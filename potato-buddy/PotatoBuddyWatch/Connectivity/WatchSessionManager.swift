import Foundation
import WatchConnectivity
import WidgetKit

/// 워치 측 세션 관리자
/// - 폰이 보낸 applicationContext 로 로그인 정보를 저장
/// - 토큰 만료 시 폰에 새 토큰을 요청 (동시 요청은 하나로 합침)
@MainActor
final class WatchSessionManager: NSObject, ObservableObject {
    static let shared = WatchSessionManager()

    @Published private(set) var credentials: WatchCredentials? = WatchCredentialStore.load()

    /// 폰 요청 중복 방지용
    private var inFlightRequest: Task<WatchCredentials, Error>?

    /// 기능별 API 가 공용으로 쓰는 클라이언트 (401 시 폰에서 토큰 갱신)
    nonisolated let apiClient = WatchAPIClient { staleToken in
        try await WatchSessionManager.shared.requestFreshSession(staleToken: staleToken)
    }

    private override init() {
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    /// 폰에 최신 세션을 요청
    /// - Parameter staleToken: 만료된 토큰. 폰은 이 값이 자기 토큰과 같을 때만 갱신한다.
    @discardableResult
    func requestFreshSession(staleToken: String?) async throws -> WatchCredentials {
        if let inFlightRequest {
            return try await inFlightRequest.value
        }

        let task = Task<WatchCredentials, Error> {
            defer { self.inFlightRequest = nil }
            let reply = try await self.sendRequest(staleToken: staleToken)
            guard let payload = WatchSessionPayload(dictionary: reply) else {
                throw WatchAPIError.phoneUnreachable
            }
            self.apply(payload)
            guard let credentials = self.credentials else { throw WatchAPIError.notLoggedIn }
            return credentials
        }
        inFlightRequest = task
        return try await task.value
    }

    private func sendRequest(staleToken: String?) async throws -> [String: Any] {
        let session = WCSession.default
        guard session.activationState == .activated, session.isReachable else {
            throw WatchAPIError.phoneUnreachable
        }

        var message: [String: Any] = [WatchSyncKey.kind: WatchSyncKind.requestSession]
        if let staleToken { message[WatchSyncKey.accessToken] = staleToken }

        return try await withCheckedThrowingContinuation { continuation in
            session.sendMessage(message) { reply in
                continuation.resume(returning: reply)
            } errorHandler: { error in
                continuation.resume(throwing: error)
            }
        }
    }

    private func apply(_ payload: WatchSessionPayload) {
        let newValue: WatchCredentials? = payload.loggedIn && !payload.accessToken.isEmpty
            ? WatchCredentials(userId: payload.userId, accessToken: payload.accessToken)
            : nil
        guard newValue != credentials else { return }

        // 다른 계정으로 바뀌었거나 로그아웃이면 이전 계정의 캐시 삭제
        if newValue?.userId != credentials?.userId {
            TodayTasksSnapshotStore.clear()
        }

        if let newValue {
            WatchCredentialStore.save(newValue)
        } else {
            WatchCredentialStore.clear()
        }
        credentials = newValue
        WidgetCenter.shared.reloadAllTimelines()
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionManager: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        // 워치 앱이 꺼져 있는 동안 도착한 마지막 세션 반영
        let context = session.receivedApplicationContext
        Task { @MainActor in
            if let payload = WatchSessionPayload(dictionary: context) {
                self.apply(payload)
            }
        }
    }

    nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        Task { @MainActor in
            if let payload = WatchSessionPayload(dictionary: applicationContext) {
                self.apply(payload)
            }
        }
    }
}
