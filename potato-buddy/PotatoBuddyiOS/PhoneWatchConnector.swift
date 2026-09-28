import Foundation
import WatchConnectivity

/// 애플워치와 로그인 세션을 동기화하는 iOS 측 연결자
/// - 세션이 바뀔 때마다 applicationContext 로 워치에 전달
/// - 워치의 토큰 갱신 요청(sendMessage)에 응답. 앱이 꺼져 있어도 백그라운드로 깨워져 처리된다.
@MainActor
final class PhoneWatchConnector: NSObject {
    static let shared = PhoneWatchConnector()

    private var session: WCSession? {
        WCSession.isSupported() ? WCSession.default : nil
    }

    private override init() {
        super.init()
    }

    /// 앱 실행 직후 호출 (백그라운드 실행 포함)
    func activate() {
        guard let session else { return }
        session.delegate = self
        session.activate()

        NotificationCenter.default.addObserver(
            forName: .authSessionUpdated,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.pushSession() }
        }
    }

    /// 현재 세션을 워치에 전달
    func pushSession() {
        guard let session,
              session.activationState == .activated,
              session.isPaired,
              session.isWatchAppInstalled else { return }

        do {
            try session.updateApplicationContext(currentPayload().dictionary)
        } catch {
            print("[PhoneWatchConnector] 세션 전달 실패: \(error.localizedDescription)")
        }
    }

    private func currentPayload() -> WatchSessionPayload {
        let auth = AuthService.shared
        guard auth.isLoggedIn else { return .loggedOut }
        return WatchSessionPayload(loggedIn: true, userId: auth.userId, accessToken: auth.accessToken)
    }

    /// 워치가 보낸 토큰이 폰의 현재 토큰과 같으면(= 둘 다 만료) 갱신 후 응답
    private func freshPayload(staleToken: String?) async -> WatchSessionPayload {
        let auth = AuthService.shared
        if auth.isLoggedIn, let staleToken, staleToken == auth.accessToken {
            do {
                try await auth.refreshSession()
            } catch {
                print("[PhoneWatchConnector] 토큰 갱신 실패: \(error.localizedDescription)")
            }
        }
        return currentPayload()
    }
}

// MARK: - WCSessionDelegate

extension PhoneWatchConnector: WCSessionDelegate {
    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        Task { @MainActor in self.pushSession() }
    }

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        // 워치를 바꿔 페어링한 경우 새 워치와 다시 연결
        session.activate()
    }

    nonisolated func sessionWatchStateDidChange(_ session: WCSession) {
        // 워치 앱이 새로 설치되면 세션을 바로 넘겨줌
        Task { @MainActor in self.pushSession() }
    }

    nonisolated func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any],
        replyHandler: @escaping ([String: Any]) -> Void
    ) {
        guard message[WatchSyncKey.kind] as? String == WatchSyncKind.requestSession else {
            replyHandler([:])
            return
        }
        let staleToken = message[WatchSyncKey.accessToken] as? String
        Task { @MainActor in
            let payload = await self.freshPayload(staleToken: staleToken)
            replyHandler(payload.dictionary)
        }
    }
}
